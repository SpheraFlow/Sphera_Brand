import json
import os
import random
import time
from datetime import datetime, timedelta, timezone

from pytrends.request import TrendReq


TZ_BR = timezone(timedelta(hours=-3))


class TrendsService:
    def __init__(self, cache_path: str, cache_duration_hours: int = 24, request_delay_seconds: int = 2):
        self.cache_path = cache_path
        self.cache_duration_hours = int(cache_duration_hours or 24)
        self.request_delay_seconds = int(request_delay_seconds or 2)
        self.pytrends = TrendReq(hl='pt-BR', tz=-180)

    def _sleep(self):
        base = max(0, self.request_delay_seconds)
        jitter = random.uniform(0, 1)
        time.sleep(base + jitter)

    def _read_cache(self):
        if not os.path.exists(self.cache_path):
            return None
        try:
            with open(self.cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None

    def _write_cache(self, data: dict):
        tmp = f"{self.cache_path}.tmp"
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, self.cache_path)

    def _is_cache_valid(self, cache: dict) -> bool:
        try:
            ts = cache.get('timestamp_iso')
            if not ts:
                return False
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=TZ_BR)
            return datetime.now(TZ_BR) - dt < timedelta(hours=self.cache_duration_hours)
        except Exception:
            return False

    def _pytrends_call_with_retry(self, fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            msg = str(e).lower()
            if '429' in msg or 'too many requests' in msg:
                time.sleep(60)
                return fn(*args, **kwargs)
            raise

    def buscar_trends_brasil(self, use_cache: bool = True):
        cache = self._read_cache() if use_cache else None
        if cache and self._is_cache_valid(cache) and isinstance(cache.get('trends_geral_br'), list):
            return cache.get('trends_geral_br')

        self._sleep()
        df = self._pytrends_call_with_retry(self.pytrends.realtime_trending_searches, pn='BR')
        trends = []
        if df is not None and len(df.columns) > 0:
            title_col = None
            for c in df.columns:
                if str(c).lower() in ['title', 'query', 'term']:
                    title_col = c
                    break
            if title_col is None:
                title_col = df.columns[0]
            
            for v in df[title_col].tolist():
                s = str(v).strip()
                if s:
                    trends.append(s)

        new_cache = cache if isinstance(cache, dict) else {}
        new_cache['timestamp_iso'] = datetime.now(TZ_BR).isoformat()
        new_cache['data'] = datetime.now(TZ_BR).date().isoformat()
        new_cache['trends_geral_br'] = trends
        if 'trends_por_categoria' not in new_cache or not isinstance(new_cache.get('trends_por_categoria'), dict):
            new_cache['trends_por_categoria'] = {}
        self._write_cache(new_cache)
        return trends

    def buscar_trends_por_categoria(self, categoria_code: str, use_cache: bool = True):
        categoria_code = str(categoria_code or '').strip()
        cache = self._read_cache() if use_cache else None
        if categoria_code and cache and self._is_cache_valid(cache):
            per_cat = cache.get('trends_por_categoria')
            if isinstance(per_cat, dict) and isinstance(per_cat.get(categoria_code), list):
                return per_cat.get(categoria_code)

        trends = []
        try:
            self._sleep()
            df = self._pytrends_call_with_retry(self.pytrends.realtime_trending_searches, pn='BR')
            if df is not None:
                col = None
                for c in df.columns:
                    if str(c).lower() in ['title', 'query', 'term']:
                        col = c
                        break
                if col is None and len(df.columns) > 0:
                    col = df.columns[0]
                if col is not None:
                    for v in df[col].tolist():
                        s = str(v).strip()
                        if s:
                            trends.append(s)
        except Exception:
            trends = self.buscar_trends_brasil(use_cache=use_cache)

        cache = cache if isinstance(cache, dict) else {}
        cache['timestamp_iso'] = datetime.now(TZ_BR).isoformat()
        cache['data'] = datetime.now(TZ_BR).date().isoformat()
        cache.setdefault('trends_geral_br', [])
        cache.setdefault('trends_por_categoria', {})
        cache['trends_por_categoria'][categoria_code or 'unknown'] = trends
        self._write_cache(cache)
        return trends

    def buscar_trends_por_palavra_chave(self, keywords):
        kw_list = [str(k).strip() for k in (keywords or []) if str(k).strip()]
        if not kw_list:
            return {}

        self._sleep()
        self._pytrends_call_with_retry(
            self.pytrends.build_payload,
            kw_list=kw_list,
            geo='BR',
            timeframe='today 3-m',
        )
        self._sleep()
        df = self._pytrends_call_with_retry(self.pytrends.interest_over_time)
        out = {}
        if df is not None and len(df.index) > 0:
            for kw in kw_list:
                try:
                    series = df[kw]
                    out[kw] = int(series.iloc[-1])
                except Exception:
                    out[kw] = 0
        return out

    def filtrar_trends_relevantes(self, trends, dna_keywords, min_score: int = 50, max_items: int = 10):
        dna = [str(k).strip().lower() for k in (dna_keywords or []) if str(k).strip()]
        dna_set = set(dna)
        scored = []

        for t in trends or []:
            s = str(t).strip()
            if not s:
                continue
            tl = s.lower()
            hits = 0
            for kw in dna_set:
                if kw and kw in tl:
                    hits += 1
            score = min(100, 40 + hits * 30) if hits > 0 else 0
            if score >= int(min_score or 0):
                scored.append({'trend_keyword': s, 'trend_score': score})

        scored.sort(key=lambda x: x['trend_score'], reverse=True)
        return scored[: int(max_items or 10)]
