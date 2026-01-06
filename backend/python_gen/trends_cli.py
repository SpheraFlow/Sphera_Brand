import json
import os
import sys

from trends_service import TrendsService


def _safe_json_load(s: str):
    try:
        return json.loads(s)
    except Exception:
        return None


def main():
    payload = _safe_json_load(sys.argv[1]) if len(sys.argv) > 1 else None
    if not isinstance(payload, dict):
        print(json.dumps({'ok': False, 'error': 'invalid_payload'}, ensure_ascii=False))
        return

    cache_path = payload.get('cache_path')
    if not cache_path:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cache_path = os.path.join(base_dir, 'trends_cache.json')

    cfg = payload.get('config') or {}
    svc = TrendsService(
        cache_path=str(cache_path),
        cache_duration_hours=int(cfg.get('CACHE_DURATION_HOURS', 24)),
        request_delay_seconds=int(cfg.get('REQUEST_DELAY_SECONDS', 2)),
    )

    dna_keywords = payload.get('dna_keywords') or []
    categorias = payload.get('categorias') or []
    min_score = int(cfg.get('MIN_TREND_SCORE', 50))
    max_items = int(cfg.get('MAX_TRENDS_PER_CLIENTE', 10))

    trends = []
    try:
        trends.extend(svc.buscar_trends_brasil(use_cache=True))
    except Exception:
        trends = []

    for cat in categorias:
        try:
            trends.extend(svc.buscar_trends_por_categoria(str(cat), use_cache=True))
        except Exception:
            continue

    seen = set()
    uniq = []
    for t in trends:
        key = str(t).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        uniq.append(str(t).strip())

    suggestions = svc.filtrar_trends_relevantes(uniq, dna_keywords=dna_keywords, min_score=min_score, max_items=max_items)

    print(json.dumps({'ok': True, 'suggestions': suggestions}, ensure_ascii=False))


if __name__ == '__main__':
    main()
