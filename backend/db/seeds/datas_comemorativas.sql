-- Seed inicial de datas comemorativas brasileiras
-- Estrutura: data, titulo, categorias (jsonb), descricao, relevancia

INSERT INTO datas_comemorativas (data, titulo, categorias, descricao, relevancia) VALUES
  ('2025-01-01', 'Confraternização Universal / Ano Novo', '["geral"]', 'Início do ano, campanhas de planejamento, metas e renovação.', 5),
  ('2025-01-15', 'Dia do Compositor', '["geral","entretenimento"]', 'Conteúdos ligados a música, criatividade e bastidores artísticos.', 3),
  ('2025-01-25', 'Aniversário de São Paulo', '["geral","varejo","servicos"]', 'Data forte para negócios com atuação em SP: promoções e campanhas regionais.', 4),

  ('2025-02-14', 'Dia de São Valentim (Valentine''s Day)', '["geral","varejo","servicos"]', 'Usado em campanhas de relacionamento, casais e presentes, mesmo não sendo data oficial no Brasil.', 3),
  ('2025-03-01', 'Período de Carnaval (2025)', '["geral","entretenimento","turismo"]', 'Blocos de rua, viagens, campanhas de cuidados e folia. Ajustar datas anuais conforme calendário em seeds futuros.', 5),

  ('2025-03-08', 'Dia Internacional da Mulher', '["geral","servicos","saude"]', 'Muito usado em campanhas de empoderamento, saúde da mulher e varejo voltado ao público feminino.', 5),
  ('2025-03-15', 'Dia Mundial do Consumidor', '["varejo","servicos","tech"]', 'Data forte para ofertas, campanhas de aquisição e reforço de atendimento ao cliente.', 5),

  ('2025-04-07', 'Dia Mundial da Saúde', '["saude","geral"]', 'Oportunidade para educação em saúde, bem-estar, prevenção e campanhas institucionais.', 5),
  ('2025-04-21', 'Tiradentes', '["geral"]', 'Feriado nacional, pode ser usado para conteúdos de história, civismo ou descanso.', 3),

  ('2025-05-01', 'Dia do Trabalhador', '["geral","servicos"]', 'Campanhas voltadas a carreira, reconhecimento de equipes, produtividade e descanso.', 4),
  ('2025-05-12', 'Dia das Mães (exemplo)', '["varejo","servicos","saude"]', 'Uma das principais datas comerciais do ano. Ajustar para o 2º domingo de maio em cada ano.', 5),

  ('2025-06-12', 'Dia dos Namorados', '["varejo","servicos","entretenimento"]', 'Altamente relevante para campanhas de presentes, experiências a dois e relacionamento.', 5),

  ('2025-08-11', 'Dia do Estudante', '["educacao","geral","tech"]', 'Focado em educação, cursos, tecnologia educacional e jovens.', 4),
  ('2025-08-10', 'Dia dos Pais (2025)', '["varejo","servicos"]', 'Data comercial importante (2º domingo de agosto). Para outros anos, ajustar conforme calendário.', 5),

  ('2025-09-07', 'Independência do Brasil', '["geral"]', 'Feriado nacional, usado em campanhas patrióticas e institucionais.', 4),

  ('2025-10-12', 'Dia das Crianças', '["varejo","educacao","entretenimento"]', 'Data muito forte para brinquedos, educação, lazer e tecnologia infantil.', 5),
  ('2025-10-31', 'Halloween', '["entretenimento","varejo","tech"]', 'Crescendo no Brasil, bom para campanhas criativas, fantasias, jogos e cultura pop.', 3),

  ('2025-11-15', 'Proclamação da República', '["geral"]', 'Feriado nacional, pode ser usado em conteúdos históricos e institucionais.', 3),
  ('2025-11-28', 'Black Friday (2025)', '["varejo","tech","servicos"]', 'Principal data de vendas do e-commerce, forte em praticamente todos os nichos.', 5),

  ('2025-12-24', 'Véspera de Natal', '["geral","varejo","servicos"]', 'Momento de fechamento de campanhas natalinas, mensagens emocionais e família.', 5),
  ('2025-12-25', 'Natal', '["geral","varejo","servicos"]', 'Data mais forte do varejo tradicional, foco em família, presentes e gratidão.', 5),
  ('2025-12-31', 'Véspera de Ano Novo', '["geral"]', 'Encerramento do ano, retrospectivas, metas e virada.', 5);

-- OBS: este seed traz um subconjunto representativo.
-- Para produção, recomenda-se expandir para 150-200 datas ao longo do ano,
-- ajustando datas móveis (Carnaval, Páscoa, Dia das Mães, etc.) conforme o calendário.
