@echo off
echo ================================================
echo    INSTALADOR POSTGRESQL - MVP BACKEND
echo ================================================
echo.
echo Este script ira ajuda-lo a instalar o PostgreSQL
echo.
echo OPCAO 1: Download Oficial
echo -----------------------------------------
echo 1. Abrindo pagina de download do PostgreSQL...
start https://www.postgresql.org/download/windows/
echo.
echo 2. Baixe e execute o instalador
echo 3. Durante a instalacao, anote a SENHA do usuario postgres
echo 4. Use a porta padrao: 5432
echo.
echo -----------------------------------------
echo OPCAO 2: Verificar se ja esta instalado
echo -----------------------------------------
echo.
echo Verificando se PostgreSQL esta instalado...
echo.

where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL encontrado!
    psql --version
    echo.
    echo Deseja criar o banco agora? (S/N)
    set /p resposta=
    if /i "%resposta%"=="S" (
        echo.
        echo Digite a senha do usuario postgres:
        psql -U postgres -c "CREATE DATABASE mvp_database;"
        if %ERRORLEVEL% EQU 0 (
            echo [OK] Banco criado com sucesso!
            echo.
            echo Criando tabela de posts...
            psql -U postgres -d mvp_database -f database.sql
            if %ERRORLEVEL% EQU 0 (
                echo [OK] Tabela criada com sucesso!
                echo.
                echo ================================================
                echo    CONFIGURACAO CONCLUIDA!
                echo ================================================
                echo.
                echo Agora edite o arquivo .env com sua senha
                echo Depois execute: npm run dev
                echo.
            )
        )
    )
) else (
    echo [X] PostgreSQL NAO encontrado
    echo.
    echo Por favor, instale o PostgreSQL pela pagina que foi aberta
    echo Ou acesse manualmente: https://www.postgresql.org/download/windows/
    echo.
)

echo.
echo Pressione qualquer tecla para sair...
pause >nul

