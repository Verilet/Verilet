# Test Database (`test_dataBase`)

## What it is

`test_dataBase` is a copy of the `averagePrice` database on the team's Atlas cluster (`verilet-shared`). It has the same collections and the same rent records:

| Collection                     | What it holds                                    |
| ------------------------------ | ------------------------------------------------ |
| `santaCruz`                    | Santa Cruz County average rents (ZIP and county) |
| `sanJose-sunnyVale-santaClara` | San Jose-Sunnyvale-Santa Clara average rents     |

## What it is for

- **Trying things safely.** Run the app or a script against real-shaped data without any risk to the live `averagePrice` data.
- **Testing queries.** Check that checker queries return what you expect before pointing them at the real data.
- **Experimenting with data changes.** Try an edit here first, such as a recalculated average or a new ZIP, before making it in `averagePrice`.

Anything in `test_dataBase` can be changed or deleted. Re-copy it whenever you want it to match `averagePrice` again.

> Unit tests (`npm --prefix server test`) do **not** use this database. They mock Mongoose and never connect to Atlas.

## Pointing the server at it

The rent models read the database name from `RENT_DB_NAME` in `server/.env`:

```env
RENT_DB_NAME=test_dataBase
```

If `RENT_DB_NAME` is not set or is empty, the server uses `averagePrice`. Database names are case-sensitive, so `test_database` is a different, empty database. A name MongoDB does not allow (for example one with a space or a `.`) stops the server at startup with an error naming `RENT_DB_NAME`.

Restart the server after changing `RENT_DB_NAME`; the name is read once when the rent models load.

## Re-copying it from `averagePrice`

The copy does not update itself. Edits to `averagePrice` do not appear in `test_dataBase` until you re-copy.

### 1. Install MongoDB Database Tools (once)

- **Windows:** `winget install --id MongoDB.DatabaseTools --exact`. The tools install to `C:\Program Files\MongoDB\Tools\100\bin`.
- **macOS:** `brew install mongodb/brew/mongodb-database-tools`
- **Other:** download "MongoDB Database Tools" from mongodb.com.

### 2. Run the copy

Run these from the repository root. They read `MONGO_URI` from `server/.env`, so the connection string never appears in the command or your shell history.

**PowerShell (Windows):**

```powershell
$env:MONGO_URI = ((Get-Content server\.env | Where-Object { $_ -match '^MONGO_URI=' }) -replace '^MONGO_URI=', '').Trim().Trim('"', "'")
$tools = 'C:\Program Files\MongoDB\Tools\100\bin'
$file  = "$env:TEMP\averagePrice.archive"

& "$tools\mongodump.exe" --uri $env:MONGO_URI --db averagePrice --archive=$file
& "$tools\mongorestore.exe" --uri $env:MONGO_URI --archive=$file --nsFrom 'averagePrice.*' --nsTo 'test_dataBase.*' --drop
Remove-Item $file
```

**Bash (macOS / Linux / Git Bash):**

```bash
MONGO_URI="$(grep '^MONGO_URI=' server/.env | cut -d= -f2- | tr -d "\"'")"
FILE="${TMPDIR:-/tmp}/averagePrice.archive"

mongodump --uri "$MONGO_URI" --db averagePrice --archive="$FILE"
mongorestore --uri "$MONGO_URI" --archive="$FILE" --nsFrom 'averagePrice.*' --nsTo 'test_dataBase.*' --drop
rm "$FILE"
```

### What each step does

| Step                                    | Effect                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mongodump ... --db averagePrice`       | Reads every collection in `averagePrice` into one archive file. **Read-only**: `averagePrice` is not changed.                          |
| `--nsFrom ... --nsTo 'test_dataBase.*'` | Renames each collection on the way in, so `averagePrice.santaCruz` is restored as `test_dataBase.santaCruz`.                           |
| `--drop`                                | Empties each `test_dataBase` collection before restoring, so re-copying replaces the old copy instead of failing on duplicate records. |
| `Remove-Item` / `rm`                    | Deletes the temporary archive. It is saved outside the repo, so it can't be committed by accident.                                     |

### 3. Check it worked

The last line of the `mongorestore` output should report `0 document(s) failed to restore`. In Atlas Data Explorer, refresh the database list. Each `test_dataBase` collection should have the same document count as its `averagePrice` counterpart.

## Rules

- **Never restore into `averagePrice`.** Always keep `--nsTo 'test_dataBase.*'` in the restore command. With `--drop` and no `--nsTo`, the restore overwrites the real data.
- **Don't commit the connection string** or the archive file.
- `test_dataBase` is on the shared cluster, so teammates see it too. Tell the team before re-copying if someone may be using it.
