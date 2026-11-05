"""Small async client for the public Bungie platform API."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import aiohttp

_BUNGIE_NAME = re.compile(r"^.+#\d{4}$")
_MEMBERSHIP_TYPE_PRIORITY = (3, 2, 1, 4, 5, 6, 10, 20, 254)
logger = logging.getLogger(__name__)


class BungieApiError(RuntimeError):
    """A safe-to-display Bungie API failure."""


@dataclass(frozen=True, slots=True)
class BungieMembership:
    membership_id: str
    membership_type: int
    bungie_name: str


def split_bungie_name(value: str) -> tuple[str, int]:
    """Validate and split a Bungie Name without accepting partial suffixes."""
    normalized = value.strip()
    if not _BUNGIE_NAME.fullmatch(normalized):
        raise BungieApiError("Informe o Bungie Name completo no formato Nome#1234.")
    display_name, code = normalized.rsplit("#", 1)
    if not display_name.strip():
        raise BungieApiError("O nome antes do # não pode ficar vazio.")
    return display_name, int(code)


class BungieClient:
    """Async HTTP client with bounded timeouts and response validation."""

    API_ROOT = "https://www.bungie.net/Platform"

    def __init__(self, api_key: str, timeout_seconds: float = 12.0) -> None:
        if not api_key.strip():
            raise BungieApiError("A integração Bungie ainda não está configurada.")
        self._api_key = api_key.strip()
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds, connect=5.0, sock_read=timeout_seconds)
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> BungieClient:
        self._session = aiohttp.ClientSession(
            timeout=self._timeout,
            headers={"X-API-Key": self._api_key, "User-Agent": "OrlaBot/1.0"},
        )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        headers = {"X-API-Key": self._api_key, "User-Agent": "OrlaBot/1.0"}
        for attempt in range(3):
            try:
                session = self._session
                if session is None:
                    session = aiohttp.ClientSession(timeout=self._timeout, headers=headers)
                async with session.request(method, f"{self.API_ROOT}{path}", **kwargs) as response:
                    if response.status == 429 and attempt < 2:
                        try:
                            retry_after = min(float(response.headers.get("Retry-After", "1")), 3.0)
                        except ValueError:
                            retry_after = 1.0
                        await asyncio.sleep(max(retry_after, 0.1))
                        continue
                    if response.status >= 500 and attempt < 2:
                        await asyncio.sleep(0.25 * (attempt + 1))
                        continue
                    if response.status >= 400:
                        raise BungieApiError("A Bungie API recusou a solicitação.")
                    try:
                        payload = await response.json(content_type=None)
                    except (aiohttp.ContentTypeError, json.JSONDecodeError) as exc:
                        raise BungieApiError("A Bungie retornou uma resposta inválida.") from exc
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                if attempt < 2:
                    await asyncio.sleep(0.25 * (attempt + 1))
                    continue
                raise BungieApiError("Não foi possível consultar a Bungie agora.") from exc
            if not isinstance(payload, dict) or payload.get("ErrorCode") != 1:
                raise BungieApiError("A Bungie não retornou dados válidos para esta solicitação.")
            body = payload.get("Response")
            if not isinstance(body, (dict, list)):
                raise BungieApiError("A Bungie retornou uma resposta incompleta.")
            return {"Response": body}
        raise BungieApiError("A Bungie API está temporariamente indisponível.")

    async def find_membership(self, bungie_name: str) -> BungieMembership:
        display_name, code = split_bungie_name(bungie_name)
        result = await self._request(
            "POST",
            "/Destiny2/SearchDestinyPlayerByBungieName/-1/",
            json={"displayName": display_name, "displayNameCode": code},
        )
        matches = result["Response"]
        if not isinstance(matches, list) or not matches:
            raise BungieApiError("Não encontrei esse Bungie Name. Confira o nome e o código.")
        exact: list[dict[str, Any]] = []
        valid_memberships = 0
        name_matches = 0
        code_matches = 0
        for item in matches:
            if not isinstance(item, dict):
                continue
            membership_id = item.get("membershipId")
            membership_type = item.get("membershipType")
            has_membership = bool(membership_id) and isinstance(membership_type, int)
            if has_membership:
                valid_memberships += 1
            returned_name = item.get("bungieGlobalDisplayName")
            name_matches_item = (
                isinstance(returned_name, str)
                and returned_name.casefold() == display_name.casefold()
            )
            if name_matches_item:
                name_matches += 1
            returned_code = item.get("bungieGlobalDisplayNameCode")
            try:
                code_matches_item = int(returned_code) == code
            except (TypeError, ValueError):
                code_matches_item = False
            if code_matches_item:
                code_matches += 1
            if has_membership and name_matches_item and code_matches_item:
                exact.append(item)

        logger.info(
            "Bungie Name search validation: responses=%d valid_memberships=%d "
            "name_matches=%d code_matches=%d exact_matches=%d",
            len(matches), valid_memberships, name_matches, code_matches, len(exact),
        )
        if not exact:
            raise BungieApiError(
                "A Bungie encontrou resultados, mas não confirmou o Bungie Name completo. "
                "Confira o nome e o código de quatro dígitos no seu perfil."
            )
        membership_by_type: dict[int, dict[str, Any]] = {}
        for item in exact:
            membership_type = item["membershipType"]
            if membership_type in _MEMBERSHIP_TYPE_PRIORITY:
                membership_by_type.setdefault(membership_type, item)
        selected_type = next(
            (membership_type for membership_type in _MEMBERSHIP_TYPE_PRIORITY
             if membership_type in membership_by_type),
            None,
        )
        if selected_type is None:
            logger.warning(
                "Bungie Name search had exact matches but no supported membership types; "
                "exact_matches=%d returned_types=%s",
                len(exact),
                sorted({int(item["membershipType"]) for item in exact}),
            )
            raise BungieApiError(
                "A Bungie confirmou o Bungie Name, mas não retornou um tipo de plataforma compatível."
            )
        member = membership_by_type[selected_type]
        logger.info("Selected Bungie membership type %d from the search response", selected_type)
        return BungieMembership(
            membership_id=str(member["membershipId"]),
            membership_type=int(member["membershipType"]),
            bungie_name=f"{display_name}#{code:04d}",
        )

    async def get_clear_counts(
        self,
        membership: BungieMembership,
        activity_hashes: set[int],
        mode: int,
    ) -> dict[int, int]:
        """Return aggregate clears for each requested activity hash.

        Bungie's aggregate endpoint is character-scoped, so totals are summed
        across every character in the linked Destiny profile. Activity variants
        remain separate because the response is keyed by activity hash.
        """
        if mode not in (4, 82):
            raise BungieApiError("Só é possível consultar histórico de Raids ou Dungeons.")
        if not activity_hashes:
            raise BungieApiError("Não há atividades para consultar no catálogo.")
        linked = await self._request(
            "GET",
            f"/Destiny2/{membership.membership_type}/Profile/{membership.membership_id}/LinkedProfiles/",
        )
        linked_response = linked["Response"]
        linked_profiles = linked_response.get("profiles") if isinstance(linked_response, dict) else None
        if not isinstance(linked_profiles, list) or not linked_profiles:
            raise BungieApiError("A Bungie não disponibilizou perfis vinculados para consultar o histórico.")

        profiles: list[tuple[int, str]] = []
        seen_profiles: set[tuple[int, str]] = set()
        for linked_profile in linked_profiles:
            if not isinstance(linked_profile, dict):
                raise BungieApiError("A Bungie retornou um perfil vinculado inválido.")
            profile_id = linked_profile.get("membershipId")
            profile_type = linked_profile.get("membershipType")
            if (not isinstance(profile_type, int) or isinstance(profile_type, bool)
                    or not isinstance(profile_id, (str, int)) or not str(profile_id).isdecimal()):
                raise BungieApiError("A Bungie retornou identificadores de perfil inválidos.")
            profile_key = (profile_type, str(profile_id))
            if profile_key not in seen_profiles:
                profiles.append(profile_key)
                seen_profiles.add(profile_key)

        character_profiles: list[tuple[int, str, str]] = []
        for profile_type, profile_id in profiles:
            profile = await self._request(
                "GET",
                f"/Destiny2/{profile_type}/Profile/{profile_id}/",
                params={"components": "Profiles"},
            )
            response = profile["Response"]
            profile_info = response.get("profile", {}).get("data", {}) if isinstance(response, dict) else {}
            character_ids = profile_info.get("characterIds", [])
            if not isinstance(character_ids, list):
                raise BungieApiError("A Bungie retornou uma lista de personagens inválida.")
            if any(
                not (isinstance(character_id, int) and not isinstance(character_id, bool) and character_id > 0)
                and not (isinstance(character_id, str) and character_id.isdecimal())
                for character_id in character_ids
            ):
                raise BungieApiError("A Bungie retornou identificadores de personagem inválidos.")
            character_profiles.extend((profile_type, profile_id, str(character_id)) for character_id in character_ids)
        if not character_profiles:
            raise BungieApiError("A Bungie não disponibilizou personagens para consultar o histórico.")

        # Keep only hashes Bungie actually reports. A pre-filled zero map makes
        # an absent activity indistinguishable from an observed zero and causes
        # callers to cache an unverified zero-clear result.
        counts: dict[int, int] = {}
        logger.info(
            "Bungie aggregate activity lookup started mode=%d target_hashes=%d characters=%d",
            mode,
            len(activity_hashes),
            len(character_profiles),
        )
        for character_index, (profile_type, profile_id, character_id) in enumerate(character_profiles, start=1):
            result = await self._request(
                "GET",
                f"/Destiny2/{profile_type}/Account/{profile_id}"
                f"/Character/{character_id}/Stats/AggregateActivityStats/",
            )
            body = result["Response"]
            activities = body.get("activities") if isinstance(body, dict) else None
            if not isinstance(activities, list):
                raise BungieApiError("A Bungie retornou estatísticas agregadas em formato inválido.")
            character_matches = 0
            for entry in activities:
                if not isinstance(entry, dict):
                    raise BungieApiError("A Bungie retornou uma atividade agregada inválida.")
                activity_hash = entry.get("activityHash")
                if not isinstance(activity_hash, int) or isinstance(activity_hash, bool):
                    raise BungieApiError("A Bungie retornou um hash de atividade inválido.")
                if activity_hash not in activity_hashes:
                    continue
                values = entry.get("values")
                completions = values.get("activityCompletions") if isinstance(values, dict) else None
                basic = completions.get("basic") if isinstance(completions, dict) else None
                value = basic.get("value") if isinstance(basic, dict) else None
                if (
                    not isinstance(value, (int, float))
                    or isinstance(value, bool)
                    or value < 0
                    or not float(value).is_integer()
                ):
                    raise BungieApiError(
                        "A Bungie não retornou uma contagem válida de atividades concluídas."
                    )
                counts[activity_hash] = counts.get(activity_hash, 0) + int(value)
                character_matches += 1
            logger.info(
                "Bungie aggregate activity character scanned index=%d total=%d "
                "matched_activity_hashes=%d",
                character_index,
                len(character_profiles),
                character_matches,
            )
        logger.info(
            "Bungie aggregate activity lookup complete mode=%d target_hashes=%d "
            "matched_hashes=%d total_clears=%d",
            mode,
            len(activity_hashes),
            sum(count > 0 for count in counts.values()),
            sum(counts.values()),
        )
        return counts
