"""
Import helper for handling both absolute and relative imports
"""

import sys
from pathlib import Path

def try_import(absolute_module: str, relative_module: str):
    """Try absolute import first, fallback to relative"""
    try:
        return __import__(absolute_module, fromlist=[''])
    except ImportError:
        # Add parent directory to path if needed
        backend_dir = Path(__file__).parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        return __import__(relative_module, fromlist=[''])

def try_from_import(absolute_module: str, relative_module: str, names: list):
    """Try from import with absolute, fallback to relative"""
    try:
        module = __import__(absolute_module, fromlist=names)
        return {name: getattr(module, name) for name in names}
    except ImportError:
        # Add parent directory to path if needed
        backend_dir = Path(__file__).parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        module = __import__(relative_module, fromlist=names)
        return {name: getattr(module, name) for name in names}