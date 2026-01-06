import tempfile

from trends_service import TrendsService


def test_filtrar_trends_relevantes_basic():
    with tempfile.TemporaryDirectory() as td:
        svc = TrendsService(cache_path=f"{td}/cache.json")

        dna = ["fitness", "treino", "bem-estar"]
        trends = [
            "Treino HIIT em casa",
            "Promoção de smartphone",
            "Bem-estar e saúde mental",
            "Receita de bolo",
        ]

        out = svc.filtrar_trends_relevantes(trends, dna_keywords=dna, min_score=50, max_items=10)
        assert isinstance(out, list)
        assert any("treino" in x["trend_keyword"].lower() for x in out)
        assert any("bem-estar" in x["trend_keyword"].lower() for x in out)
        assert all(x["trend_score"] >= 50 for x in out)


if __name__ == '__main__':
    test_filtrar_trends_relevantes_basic()
    print('ok')
