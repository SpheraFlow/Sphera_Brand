import db from "../config/database";

export interface DataComemorativa {
  id: string;
  data: Date;
  titulo: string;
  categorias: any;
  descricao: string | null;
  relevancia: number;
}

export async function getDatasComemorativas(
  mes: number,
  ano: number,
  categorias?: string[]
): Promise<DataComemorativa[]> {
  const params: any[] = [mes, ano];
  let where = `EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2`;

  if (categorias && categorias.length > 0) {
    // O operador JSONB ?| é case-sensitive.
    // Usamos EXISTS + lower() para comparação case-insensitive.
    // As categorias no banco ficam como ["Saúde", "Feriado"] (capitalizadas),
    // mas passamos os filtros em minúsculas para garantir a correspondência.
    params.push(categorias.map(c => c.toLowerCase()));
    where += `
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(categorias) AS cat
        WHERE lower(cat) = ANY($3::text[])
      )`;
  }

  const query = `
    SELECT id, data::text as data, titulo, categorias, descricao, relevancia
    FROM datas_comemorativas
    WHERE ${where}
    ORDER BY data ASC, relevancia DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}
