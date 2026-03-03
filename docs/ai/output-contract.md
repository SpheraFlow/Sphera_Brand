# Contrato de Output de Calendário (AI Generator)

Quando gerar outputs JSON de calendários para a plataforma Sphera Brand MVP, a IA **DEVE** retornar um `array` de objetos obedecendo integralmente a esta interface TS equivalente:

```typescript
export interface CalendarItem {
  dia: number;               // Dia do mês (1 a 31). Tente distribuir bem os dias (não faça todos no dia 1)
  tema: string;              // Tema/Assunto principal da postagem
  formato: "Reels" | "Static" | "Carousel" | "Stories"; // Format type
  instrucoes_visuais: string; // Ex: "Capa do Reels com letreiro neon mostrando N dicas"
  copy_inicial: string;       // Hook inicial ou estrutura prévia de texto para o copywriter
  objetivo: string;           // Ex: Atrair topo de funil, Vender produto X, Provar autoridade
  cta: string;                // Call To Action ("Comente EU QUERO", "Link na Bio")
  palavras_chave: string[];   // Array de tags relacionadas ["dinheiro", "finanças"]
}
```

## ✅ Exemplos Válidos

**Exemplo 1 (Post Isolado no Array)**:
```json
[
  {
    "dia": 5,
    "tema": "5 Mitos sobre Investimentos",
    "formato": "Carousel",
    "instrucoes_visuais": "Slide 1 título chamativo; Slides 2 a 5 desmentindo os mitos com ícones.",
    "copy_inicial": "Você já deixou de investir por medo de perder tudo? Entenda por que a caderneta está te deixando para trás.",
    "objetivo": "Educação Financeira",
    "cta": "Salve esse post para quando for organizar suas finanças!",
    "palavras_chave": ["investimentos", "mitos financeiros", "educação financeira"]
  }
]
```

**Exemplo 2 (Post de Vendas)**:
```json
[
  {
    "dia": 10,
    "tema": "Abertura do Carrinho Mentoria X",
    "formato": "Reels",
    "instrucoes_visuais": "Vídeo do especialista em frente a um flipchart explicando o ROI do método.",
    "copy_inicial": "Estão abertas as inscrições para a Mentoria X. Este não é um curso gravado, é acompanhamento.",
    "objetivo": "Venda Direta",
    "cta": "Link na bio para garantir uma das 10 vagas.",
    "palavras_chave": ["mentoria", "lançamento", "vagas abertas", "ROI"]
  }
]
```

## ❌ Exemplos Inválidos e Motivos do Rejeite

**Exemplo 1 (Missing Field & Wrong Format Type)**:
```json
[
  {
    "dia": 12,
    "tema": "Dica rápida",
    "formato": "Video Curto", // ERRO: Deve ser "Reels" ou "Stories"
    "instrucoes_visuais": "...",
    "copy_inicial": "...",
    "objetivo": "...",
    "palavras_chave": ["dica"]
    // ERRO: FALTOU O CAMPO "cta"
  }
]
```

**Exemplo 2 (Not an Array)**:
```json
{
  "calendario": [
    {
      "dia": 4,
      ...
    }
  ]
}
```
*ERRO:* Retornou um Object encapsulando `calendario`. O sistema espera o JSON root como sendo o próprio `Array` de itens.
