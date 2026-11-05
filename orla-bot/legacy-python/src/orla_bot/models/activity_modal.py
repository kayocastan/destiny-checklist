"""Modal used to collect activity creation input from Discord users."""

from collections.abc import Awaitable, Callable
from typing import TypeVar

import discord

ActivitySubmitHandler = Callable[[discord.Interaction, str, int, str, str, int | None, int | None], Awaitable[None]]
ModalField = TypeVar("ModalField", bound=discord.ui.Item)


class ActivityModal(discord.ui.Modal, title="Criar Grade"):
    """Collect activity settings and pass them to the configured submit handler."""

    def __init__(
        self,
        submit_handler: ActivitySubmitHandler,
        *,
        atividade: str | None = None,
        integrantes: int | None = None,
        inicio: str | None = None,
        descricao: str | None = None,
        rookie_limit: int | None = None,
        curated_bungie_activity_id: int | None = None,
    ) -> None:
        super().__init__()
        self._submit_handler = submit_handler
        self._curated_bungie_activity_id = curated_bungie_activity_id
        self._catalog_activity_name = atividade if curated_bungie_activity_id is not None else None
        self.atividade_input = self.create_modal_field(
            label="Atividade",
            description="Digite o nome da atividade (até 80 caracteres).",
            component=discord.ui.TextInput(
                placeholder="Nome da atividade",
                default=atividade or None,
                max_length=80,
            ),
        )
        self.integrantes_input = self.create_modal_field(
            label="Integrantes",
            description="Quantidade de integrantes.",
            component=discord.ui.Select(
                placeholder="Escolha",
                options=[
                    discord.SelectOption(
                        label="3",
                        value="3",
                        description="Masmorras, Atividade da Vanguarda / PvP / Esquadrão padrão",
                        default=integrantes == 3,
                    ),
                    discord.SelectOption(
                        label="4",
                        value="4",
                        description="Artimanha (Gambit) / PvP",
                        default=integrantes == 4,
                    ),
                    discord.SelectOption(
                        label="6",
                        value="6",
                        description="Raids / PvP",
                        default=integrantes == 6,
                    ),
                    discord.SelectOption(
                        label="12",
                        value="12",
                        description="Excisão / PvP Privado / Outras Atividades",
                        default=integrantes == 12,
                    )
                ],
                min_values=1,
                max_values=1,
            ),
        )
        self.novatos_input = self.create_modal_field(
            label="Novatos",
            description="Máximo de novatos titulares.",
            component=discord.ui.Select(
                placeholder="Escolha",
                options=[
                    discord.SelectOption(
                        label=str(limit),
                        value=str(limit),
                        default=limit == (rookie_limit if rookie_limit is not None else 0),
                    )
                    for limit in range(13)
                ],
                min_values=1,
                max_values=1,
            ),
        )
        self.inicio_input = self.create_modal_field(
            label="Início",
            description="Use o formato DD/mm/YY HH:MM",
            component=discord.ui.TextInput(
            placeholder="30/02/26 18:99",
                default=inicio or None,
                max_length=16,
            ),
        )
        self.descricao_input = self.create_modal_field(
            label="Descrição",
            description="Informações adicionais (opcional).",
            component=discord.ui.TextInput(
                placeholder="",
                default=descricao or None,
                required=False,
                max_length=250,
                style=discord.TextStyle.paragraph,
            ),
        )

    def create_modal_field(
        self,
        *,
        label: str,
        description: str,
        component: ModalField,
    ) -> ModalField:
        """Wrap a modal component in a Discord label and add it to this modal."""
        self.add_item(discord.ui.Label(text=label, description=description, component=component))
        return component

    async def on_submit(self, interaction: discord.Interaction) -> None:
        """Forward the collected values to the application handler."""
        submitted_name = str(self.atividade_input.value)
        linked_activity_id = (
            self._curated_bungie_activity_id
            if submitted_name.strip() == self._catalog_activity_name
            else None
        )
        rookie_limit = int(self.novatos_input.values[0])
        await self._submit_handler(
            interaction,
            submitted_name,
            int(self.integrantes_input.values[0]),
            str(self.inicio_input.value),
            str(self.descricao_input.value),
            linked_activity_id,
            rookie_limit,
        )
