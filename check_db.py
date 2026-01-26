# check_db.py
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_db
from database.models import CompositionDefaults

with get_db() as session:
    defaults = session.query(CompositionDefaults).filter_by(id=1).first()
    print("pattern_settings from DB:")
    print(defaults.pattern_settings)