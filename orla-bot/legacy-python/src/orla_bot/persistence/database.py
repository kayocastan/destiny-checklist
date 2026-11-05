"""Async SQLAlchemy engine and session factory."""

from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def create_session_factory(database_url: str) -> async_sessionmaker[AsyncSession]:
    """Create an async engine-backed session factory."""
    url = make_url(database_url)
    sqlite = url.get_backend_name() == "sqlite"
    connect_args: dict[str, object] = {}
    if sqlite:
        if url.database and url.database != ":memory:":
            Path(url.database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        connect_args["timeout"] = 30
    engine = create_async_engine(
        database_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    if sqlite:
        @event.listens_for(engine.sync_engine, "connect")
        def configure_sqlite(dbapi_connection: object, _connection_record: object) -> None:
            """Enable SQLite constraints and persistent, contention-tolerant journaling."""
            setattr(dbapi_connection, "isolation_level", None)
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

        @event.listens_for(engine.sync_engine, "begin")
        def begin_sqlite_write_transaction(connection: object) -> None:
            """Serialize SQLite transactions so concurrent signups cannot overfill a grade."""
            connection.exec_driver_sql("BEGIN IMMEDIATE")  # type: ignore[attr-defined]

    return async_sessionmaker(engine, expire_on_commit=False)
