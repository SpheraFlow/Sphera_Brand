import db from '../../config/database';
import fs from 'fs';
import path from 'path';

interface DataComemorativa2026 {
  data: string;
  nome: string;
  nichos: string[];
  descricao_orientativa: string;
}

async function seedCalendario2026() {
  try {
    console.log('🌱 Iniciando seed do Calendário Estratégico 2026...');

    const jsonPath = path.resolve(__dirname, '../../../../calendario_estrategico_2026.md');
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    
    const jsonMatch = fileContent.match(/```json\n([\s\S]+?)\n```/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('JSON não encontrado no arquivo calendario_estrategico_2026.md');
    }

    const datas: DataComemorativa2026[] = JSON.parse(jsonMatch[1]);
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
            5,
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
