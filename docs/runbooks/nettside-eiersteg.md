# Eiersteg for nettsiden

## wrangler.jsonc-tillegg (etter at ressursene finnes)

Ressursene må opprettes først, ellers feiler Workers Builds:

```
npx wrangler d1 create kobberogkran
npx wrangler r2 bucket create kobberogkran-bilder
npx wrangler d1 migrations apply kobberogkran --remote
```

Legg så dette inn i `wrangler.jsonc` (bytt ut `<database_id>` med id-en fra `d1 create`).
Endringen krever menneskelig godkjenning. Hemmeligheter (`TURNSTILE_SECRET`,
`SKJEMA_HMAC`, `ANTHROPIC_API_KEY`) settes med `wrangler secret put`, aldri i filen.

```jsonc
"d1_databases": [
	{
		"binding": "DB",
		"database_name": "kobberogkran",
		"database_id": "<database_id>",
		"migrations_dir": "migrations"
	}
],
"r2_buckets": [
	{ "binding": "BILDER", "bucket_name": "kobberogkran-bilder" }
],
"send_email": [
	{ "name": "EPOST" }
],
"vars": {
	"TURNSTILE_SITE_KEY": "<site key fra Turnstile>"
}
```
