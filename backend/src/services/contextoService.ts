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
    params.push(categorias);
    where += ` AND categorias ?| $3`;
  }

  const query = `
    SELECT id, data, titulo, categorias, descricao, relevancia
    FROM datas_comemorativas
    WHERE ${where}
    ORDER BY data ASC, relevancia DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}
