"""Skill vocabulary for spotting skills inside free text (TruthChecker).

A term found in an AI-written bullet must be one of the user's own skills.
Ambiguous English words (go, swift, express, spark, rust...) are either left out or
matched case-sensitively, so "react quickly" is not read as React.
Adding a term is a data change, not a code change.
"""

# canonical name -> aliases (all lowercase). Canonical names are also matched.
ALIASES: dict[str, tuple[str, ...]] = {
    "javascript": ("js", "ecmascript"),
    "typescript": (),
    "python": (),
    "golang": ("go lang",),
    "c++": ("cpp",),
    "c#": ("csharp", "c sharp"),
    "node.js": ("nodejs", "node js"),
    "react": ("react.js", "reactjs", "react js"),
    "next.js": ("nextjs", "next js"),
    "vue": ("vue.js", "vuejs"),
    "angular": ("angularjs", "angular.js"),
    "express.js": ("expressjs",),
    "postgresql": ("postgres", "psql"),
    "mongodb": ("mongo",),
    "kubernetes": ("k8s",),
    "google cloud": ("gcp", "google cloud platform"),
    "aws": ("amazon web services",),
    "azure": ("microsoft azure",),
    "ci/cd": ("cicd", "ci cd"),
    "machine learning": ("ml",),
    "scikit-learn": ("sklearn", "scikit learn"),
    "tensorflow": (),
    "pytorch": (),
    "elasticsearch": ("elastic search", "elk"),
    "github actions": ("gh actions",),
    "ruby on rails": ("rails", "ror"),
    "apache kafka": ("kafka",),
    "apache spark": ("pyspark", "spark sql"),
    "apache airflow": ("airflow",),
    "rabbitmq": ("rabbit mq",),
    "large language models": ("llm", "llms"),
    "fastapi": ("fast api",),
    ".net": ("dotnet", "asp.net"),
}

TERMS: tuple[str, ...] = (
    # languages
    "java", "kotlin", "scala", "ruby", "php", "perl", "haskell", "elixir", "erlang",
    "clojure", "lua", "matlab", "julia", "objective-c", "bash", "powershell", "sql",
    "html", "css", "sass", "graphql", "solidity", "fortran", "cobol", "groovy",
    # frameworks / libraries
    "django", "flask", "spring boot", "laravel", "symfony", "nestjs", "svelte",
    "redux", "tailwind", "bootstrap", "jquery", "flutter", "react native", "pandas", "numpy",
    "scipy", "keras", "hugging face", "langchain", "llamaindex", "opencv", "selenium",
    "cypress", "playwright", "pytest", "junit", "mocha", "hibernate", "celery",
    "grpc", "protobuf", "webpack", "vite", "storybook", "pydantic", "sqlalchemy", "prisma",
    # data / infra / tools
    "docker", "terraform", "ansible", "pulumi", "jenkins", "gitlab", "github",
    "circleci", "argo cd", "prometheus", "grafana", "datadog", "splunk", "new relic",
    "sentry", "kibana", "logstash", "redis", "memcached", "mysql", "mariadb", "sqlite",
    "cassandra", "dynamodb", "cockroachdb", "neo4j", "snowflake", "bigquery",
    "redshift", "databricks", "dbt", "tableau", "power bi", "looker", "hadoop",
    "flink", "nginx", "linux", "unix", "git", "jira", "confluence", "figma",
    "postman", "openapi", "swagger", "ec2", "s3", "cloudformation", "cloudflare",
    "vercel", "heroku", "supabase", "firebase", "pgvector", "pinecone", "weaviate",
    "openai", "vertex ai", "sagemaker", "mlflow", "kubeflow", "istio",
    "nats", "sqs", "sns", "kinesis", "pubsub", "websockets",
    "oauth", "jwt", "saml", "keycloak", "stripe", "twilio", "sap", "salesforce",
    "microservices", "serverless",
)

# Matched only with this exact casing (common English words otherwise).
CASE_SENSITIVE: tuple[str, ...] = (
    "Go", "Rust", "Swift", "R", "C", "Express", "Spark", "Ember", "Chef", "Puppet", "Elm",
    "Render", "Apache", "Lambda", "Vault", "Consul", "Envoy", "Oracle", "Gemini", "Excel",
    "Spring", "Helm", "Hive", "Jest", "Dart", "Pulsar", "Node", "React",
)


def canonical_map() -> dict[str, str]:
    """lowercase surface form -> canonical name."""
    case_only = {t.lower() for t in CASE_SENSITIVE}
    mapping: dict[str, str] = {}
    for canonical, aliases in ALIASES.items():
        if canonical not in case_only:  # e.g. "react": only "React" (case-sensitive) counts
            mapping[canonical] = canonical
        for alias in aliases:
            mapping[alias] = canonical
    for term in TERMS:
        mapping.setdefault(term, term)
    return mapping
