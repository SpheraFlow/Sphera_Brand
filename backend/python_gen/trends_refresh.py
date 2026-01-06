import json
import os
import sys

from trends_service import TrendsService


def main():
    cache_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not cache_path:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cache_path = os.path.join(base_dir, 'trends_cache.json')

    svc = TrendsService(cache_path=cache_path)

    out = {
        'ok': True,
        'cache_path': cache_path,
        'updated': [],
    }

    try:
        svc.buscar_trends_brasil(use_cache=False)
        out['updated'].append('trends_geral_br')
    except Exception as e:
        out['ok'] = False
        out['error'] = str(e)

    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()
