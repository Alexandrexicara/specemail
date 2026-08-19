CREATE TABLE "configuracoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_empresa" varchar(100) DEFAULT 'Minha Empresa' NOT NULL,
	"site" varchar(255) DEFAULT '',
	"whatsapp" varchar(20) DEFAULT '',
	"instagram" varchar(100) DEFAULT '',
	"facebook" varchar(100) DEFAULT '',
	"email_contato" varchar(100) DEFAULT '',
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"senha" varchar(255) NOT NULL,
	"cargo" varchar(50) DEFAULT '',
	"ativo" boolean DEFAULT true,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "emails_email_unique" UNIQUE("email")
);
