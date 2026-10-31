"""Initial ContractGuard schema.

Revision ID: 0001_initial
"""
from alembic import op
from backend.app.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    # Deliberately no destructive downgrade; export the data and perform a reviewed migration instead.
    raise RuntimeError("Destructive schema downgrade is intentionally disabled.")
