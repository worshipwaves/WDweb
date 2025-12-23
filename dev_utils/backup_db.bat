@echo off
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=C:\Users\paulj\WDweb\database\backups\backup_%TIMESTAMP%.sql

echo Backing up database to %BACKUP_FILE%...
"C:\Program Files\PostgreSQL\18\bin\pg_dump" -h localhost -U postgres -d wavedesigner > "%BACKUP_FILE%"
echo Done.
pause