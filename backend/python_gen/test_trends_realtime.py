#!/usr/bin/env python3
"""Test script to verify realtime_trending_searches works"""
import sys
from pytrends.request import TrendReq

try:
    print("Iniciando teste do Google Trends realtime API...")
    pt = TrendReq(hl='pt-BR', tz=-180)
    
    print("Chamando realtime_trending_searches(pn='BR')...")
    df = pt.realtime_trending_searches(pn='BR')
    
    if df is not None and len(df) > 0:
        print(f"\n✅ Sucesso! Retornou {len(df)} trends")
        print(f"Colunas: {list(df.columns)}")
        print("\nPrimeiros 10 trends:")
        
        title_col = None
        for c in df.columns:
            if str(c).lower() in ['title', 'query', 'term']:
                title_col = c
                break
        if title_col is None:
            title_col = df.columns[0]
        
        for idx, val in enumerate(df[title_col].head(10).tolist()):
            print(f"  {idx+1}. {val}")
        
        sys.exit(0)
    else:
        print("❌ API retornou None ou DataFrame vazio")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Erro: {e}")
    sys.exit(1)
