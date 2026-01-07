import db from '../../config/database';
import fs from 'fs';
import path from 'path';

interface DataComemorativa2026 {
  data: string;
  nome: string;
  nichos: string[];
  descricao_orientativa: string;
}

function computeRelevancia(categorias: string[]): number {
  const normalized = (categorias || [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
    .map((c) => c.toLowerCase());

  const has = (needle: string) => normalized.some((c) => c.includes(needle));

  // Hierarquia de calendário
  if (has('feriado nacional')) return 10;
  if (has('ponto facultativo')) return 8;
  if (has('feriado')) return 9;

  // Datas amplas/alta aderência
  if (has('geral')) return 7;

  // Temas macro (boa aderência para conteúdo estratégico)
  if (has('esg') || has('sustentabilidade') || has('inclusao') || has('inclusão') || has('diversidade') || has('acessibilidade')) return 7;
  if (has('saude mental') || has('saúde mental') || has('saude') || has('saúde') || has('medicina')) return 6;
  if (has('financas') || has('finanças') || has('economia')) return 6;
  if (has('marketing') || has('comunicacao') || has('comunicação') || has('mídia')) return 6;
  if (has('tecnologia') || has('inovacao') || has('inovação') || has('ciencia') || has('ciência') || has('dev')) return 6;

  // Default
  return 5;
}

async function seedCalendario2026() {
  try {
    console.log('🌱 Iniciando seed do Calendário Estratégico 2026...');

    const envPath = process.env.CALENDARIO_2026_PATH?.trim();
    const candidatePaths = [
      envPath,
      path.resolve(process.cwd(), 'calendario_estrategico_2026.md'),
      path.resolve(__dirname, '../../../../calendario_estrategico_2026.md'),
      path.resolve(__dirname, '../../../calendario_estrategico_2026.md'),
    ].filter(Boolean) as string[];

    const jsonPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!jsonPath) {
      throw new Error(
        `Arquivo calendario_estrategico_2026.md não encontrado. Tente:
 - Colocar o arquivo no root do repo (/var/www/mvp-system/calendario_estrategico_2026.md)
 - Ou definir CALENDARIO_2026_PATH com o caminho completo
Paths testados: ${candidatePaths.join(', ')}`
      );
    }

    const fileContentRaw = fs.readFileSync(jsonPath, 'utf-8');
    const fileContent = fileContentRaw.replace(/^\uFEFF/, '').trim();

    const jsonString = (() => {
      const jsonMatch = fileContent.match(/```json\n([\s\S]+?)\n```/);
      if (jsonMatch && jsonMatch[1]) return jsonMatch[1].trim();

      // Novo formato: o arquivo pode ser um JSON puro (array) sem code fence
      if (fileContent.startsWith('[') || fileContent.startsWith('{')) return fileContent;

      return null;
    })();

    if (!jsonString) {
      throw new Error(
        `JSON não encontrado no arquivo calendario_estrategico_2026.md (formato esperado: bloco \`\`\`json ou JSON puro). Arquivo: ${jsonPath}`
      );
    }

    const datas: DataComemorativa2026[] = JSON.parse(jsonString);
    console.log(`📊 Total de datas a importar: ${datas.length}`);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of datas) {
      const categoriasLimpas = item.nichos
        .map(n => n.trim())
        .filter(n => n.length > 0 && n !== '');

      if (categoriasLimpas.length === 0) {
        categoriasLimpas.push('Geral');
      }

      const relevancia = computeRelevancia(categoriasLimpas);

      try {
        const result = await db.query(
          `INSERT INTO datas_comemorativas (data, titulo, categorias, descricao, relevancia, origem)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)
           ON CONFLICT (data, titulo) DO UPDATE
           SET categorias = EXCLUDED.categorias,
               descricao = EXCLUDED.descricao,
               relevancia = EXCLUDED.relevancia,
               origem = EXCLUDED.origem
           RETURNING id, (xmax = 0) AS inserted`,
          [
            item.data,
            item.nome,
            JSON.stringify(categoriasLimpas),
            item.descricao_orientativa,
            relevancia,
            'calendario_2026'
          ]
        );

        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao inserir ${item.nome} (${item.data}):`, error.message);
        skipped++;
      }
    }

    console.log('\n✅ Seed concluído!');
    console.log(`   📥 Inseridos: ${inserted}`);
    console.log(`   🔄 Atualizados: ${updated}`);
    console.log(`   ⏭️  Ignorados: ${skipped}`);
    console.log(`   📊 Total processado: ${datas.length}`);

  } catch (error: any) {
    console.error('❌ Erro ao executar seed:', error.message);
    throw error;
  } finally {
    await db.end();
  }
}

seedCalendario2026()
  .then(() => {
    console.log('🎉 Seed executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha ao executar seed:', error);
    process.exit(1);
  });
