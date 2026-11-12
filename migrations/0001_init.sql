-- D1-skjema for forespørsler, kunder og samtykker.
-- Tidspunkter er ISO 8601-tekst (UTC). Kunder gjenkjennes på telefon i E.164 (+47...).

CREATE TABLE kunder (
  id TEXT PRIMARY KEY,
  telefon TEXT NOT NULL UNIQUE,
  navn TEXT,
  epost TEXT,
  foretrukket_kanal TEXT,
  opprettet TEXT NOT NULL
);

CREATE TABLE foresporsler (
  id TEXT PRIMARY KEY,
  idem_nokkel TEXT NOT NULL UNIQUE,
  kunde_id TEXT NOT NULL REFERENCES kunder(id),
  tjeneste TEXT NOT NULL,
  hast TEXT,
  sted_tekst TEXT,
  lat REAL,
  lon REAL,
  kjoretid_min INTEGER,
  beskrivelse TEXT,
  svar_json TEXT,
  kilde TEXT,
  status TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny', 'sortert', 'varslet', 'lukket')),
  -- Lås for sortering og varsel: ISO-tid da lånet utløper. NULL betyr ikke låst.
  varsel_laast_til TEXT,
  opprettet TEXT NOT NULL,
  oppdatert TEXT NOT NULL
);

CREATE INDEX idx_foresporsler_kunde ON foresporsler(kunde_id);
CREATE INDEX idx_foresporsler_status ON foresporsler(status);

CREATE TABLE bilder (
  id TEXT PRIMARY KEY,
  foresporsel_id TEXT NOT NULL REFERENCES foresporsler(id),
  r2_nokkel TEXT NOT NULL,
  opprettet TEXT NOT NULL
);

CREATE INDEX idx_bilder_foresporsel ON bilder(foresporsel_id);

CREATE TABLE samtykker (
  id TEXT PRIMARY KEY,
  kunde_id TEXT NOT NULL REFERENCES kunder(id),
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'paaminnelser')),
  gitt INTEGER NOT NULL CHECK (gitt IN (0, 1)),
  kilde TEXT,
  opprettet TEXT NOT NULL
);

CREATE INDEX idx_samtykker_kunde ON samtykker(kunde_id);

CREATE TABLE hendelser (
  id TEXT PRIMARY KEY,
  foresporsel_id TEXT NOT NULL REFERENCES foresporsler(id),
  type TEXT NOT NULL,
  data_json TEXT,
  opprettet TEXT NOT NULL
);

CREATE INDEX idx_hendelser_foresporsel ON hendelser(foresporsel_id);

-- Ubesvarte anrop som utløste (et forsøk på) melding til innringeren. Én rad per melding:
-- et nytt anrop fra samme nummer innen 30 minutter gir ingen ny rad og ingen ny melding.
-- melding_kanal er kanalen som lyktes ('whatsapp', 'rcs', 'sms'), eller NULL hvis ingen gjorde det.
CREATE TABLE anrop (
  id TEXT PRIMARY KEY,
  fra TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  melding_kanal TEXT
);

CREATE INDEX idx_anrop_fra_opprettet ON anrop(fra, opprettet);
