/**
 * The operational side of a technology organisation: data, cloud and DevOps,
 * security, and testing.
 *
 * These four categories share one file because they are maintained together.
 * They describe the people who keep a system running rather than the people who
 * add features to it, and their job titles drift as a set -- when "DevOps
 * Engineer" splits into "Platform Engineer" and "SRE", the same reshuffle shows
 * up across the cloud, reliability and infrastructure lists within a release or
 * two, and a security or testing counterpart usually follows. Editing them side
 * by side is how the boundaries stay coherent; four separate files would mean
 * four near-identical reviews of the same change.
 *
 * Aliases carry almost all of the search load here, more than anywhere else in
 * the catalogue. Nobody types "Site Reliability Engineer" -- they type "SRE".
 * Nobody types "Kubernetes Engineer" either; they type "K8s". The same holds for
 * DBA, ETL, SOC, IAM, GRC, QA, SDET, AWS, GCP and pentest. A catalogue that
 * matched only on the displayed name would look empty to exactly the candidates
 * these entries exist for. So every abbreviation a real person would reach for
 * is listed explicitly, and nothing else is: the bar for adding an alias is that
 * someone would actually type it into a search box, because synonyms nobody uses
 * only dilute the ranking for the ones they do.
 *
 * Pure data, no lookups and no derived values. The ids are written out rather
 * than generated from the names because they are persisted alongside saved
 * interviews, and a clever slugifier is one refactor away from repointing all of
 * them at once.
 */

import type { Role } from "@/lib/roles/types";

/**
 * Data roles.
 *
 * The first three families are routinely confused by candidates and by the job
 * market alike, so the descriptions do the work of separating them: an analyst
 * answers questions about what happened, a scientist builds models that predict
 * or explain, and an engineer builds the pipelines both of them depend on. The
 * database and governance groups sit alongside because they are staffed from the
 * same pool and interview on overlapping ground.
 */
export const DATA_ROLES: Role[] = [
  // --- Analytics -----------------------------------------------------------
  // Every entry carries "Data", the single word most people start typing. The
  // BI cluster additionally carries both the abbreviation and the spelled-out
  // form, because postings use them interchangeably.
  {
    id: "data-analyst",
    name: "Data Analyst",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Data", "Analyst", "Data Analytics", "SQL", "Excel"],
    description:
      "Turns raw business data into answers, mostly through SQL, spreadsheets and dashboards that stakeholders read directly.",
    suggested: true,
    popular: true,
  },
  {
    id: "senior-data-analyst",
    name: "Senior Data Analyst",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Data", "Analyst", "Lead Data Analyst", "Data Analytics", "SQL"],
    description:
      "Owns analytics for a business area end to end, and sets the metric definitions other analysts then report against.",
  },
  {
    id: "business-intelligence-analyst",
    name: "Business Intelligence Analyst",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["BI", "Business Intelligence", "BI Analyst", "Data", "SQL"],
    description:
      "Builds the reporting layer a company runs on, translating recurring operational questions into repeatable BI reports.",
    popular: true,
  },
  {
    id: "bi-developer",
    name: "BI Developer",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["BI", "Business Intelligence", "Reporting Developer", "Data", "SQL"],
    description:
      "Develops the semantic models, cubes and reports inside a BI tool so that self-service queries return the right numbers.",
  },
  {
    id: "bi-engineer",
    name: "BI Engineer",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["BI", "Business Intelligence", "Data", "ETL", "SQL"],
    description:
      "Engineers the pipelines and warehouse tables that feed business intelligence, sitting between data engineering and reporting.",
  },
  {
    id: "data-visualization-specialist",
    name: "Data Visualization Specialist",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Data", "Data Viz", "Visualisation", "Dashboards", "BI"],
    description:
      "Designs charts and dashboards for comprehension, choosing encodings that make a pattern obvious rather than merely present.",
  },
  {
    id: "tableau-developer",
    name: "Tableau Developer",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Tableau", "BI", "Business Intelligence", "Dashboards", "Data"],
    description:
      "Builds and tunes Tableau workbooks and extracts, including the data source design that keeps them responsive at scale.",
  },
  {
    id: "power-bi-developer",
    name: "Power BI Developer",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Power BI", "PowerBI", "DAX", "BI", "Business Intelligence", "Data"],
    description:
      "Builds Power BI datasets and reports, living in DAX and the tabular model as much as in the visuals themselves.",
  },
  {
    id: "marketing-analyst",
    name: "Marketing Analyst",
    categoryId: "data",
    subcategory: "Analytics",
    aliases: ["Data", "Analyst", "Marketing Analytics", "Attribution", "Campaign Analytics"],
    description:
      "Analyses campaign spend, channel attribution and funnel performance to say which marketing actually earned its budget.",
  },

  // --- Data Science --------------------------------------------------------
  // Kept apart from Analytics deliberately: a scientist interview goes into
  // statistics and modelling, which an analyst interview mostly does not.
  {
    id: "data-scientist",
    name: "Data Scientist",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Data", "Data Science", "Machine Learning", "ML", "Python", "Statistics"],
    description:
      "Frames business problems as statistical or machine learning ones, then builds and validates the models that answer them.",
    suggested: true,
    popular: true,
  },
  {
    id: "senior-data-scientist",
    name: "Senior Data Scientist",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Data", "Data Science", "Machine Learning", "ML", "Python"],
    description:
      "Leads modelling work whose results are acted on, and is expected to defend the method chosen against the alternatives.",
  },
  {
    id: "applied-data-scientist",
    name: "Applied Data Scientist",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Data", "Data Science", "Applied Science", "Machine Learning", "ML"],
    description:
      "Works close to a shipping product, favouring models that survive real traffic over ones that win an offline benchmark.",
  },
  {
    id: "data-science-engineer",
    name: "Data Science Engineer",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Data", "Data Science", "MLOps", "Machine Learning", "Python"],
    description:
      "Takes models out of notebooks and into production, owning the serving, retraining and monitoring that surround them.",
  },
  {
    id: "quantitative-analyst",
    name: "Quantitative Analyst",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Quant", "Quantitative", "Data", "Statistics", "Finance"],
    description:
      "Applies stochastic modelling and statistics to pricing, trading or risk, where being wrong carries an immediate cost.",
  },
  {
    id: "decision-scientist",
    name: "Decision Scientist",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Data", "Decision Science", "Causal Inference", "Experimentation", "Data Science"],
    description:
      "Uses causal inference and experiment design to say what a change would do, rather than what merely correlates with it.",
  },
  {
    id: "statistician",
    name: "Statistician",
    categoryId: "data",
    subcategory: "Data Science",
    aliases: ["Statistics", "Statistical Analysis", "Data", "R", "Biostatistics"],
    description:
      "Designs studies and estimates effects with explicit assumptions and uncertainty, rather than optimising predictive accuracy.",
  },

  // --- Data Engineering ----------------------------------------------------
  // The big-data cluster carries "Hadoop" and "Spark" because those are the
  // words on the CVs and the job specs, far more often than the family name.
  {
    id: "data-engineer",
    name: "Data Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data", "ETL", "Data Pipelines", "SQL", "Spark", "Python"],
    description:
      "Builds and operates the pipelines that move data from source systems into a warehouse other people can trust.",
    suggested: true,
    popular: true,
  },
  {
    id: "big-data-engineer",
    name: "Big Data Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Big Data", "Hadoop", "Spark", "Data", "Distributed Systems"],
    description:
      "Works at the volume where processing has to be distributed, tuning jobs that would never fit on a single machine.",
  },
  {
    id: "etl-developer",
    name: "ETL Developer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["ETL", "Data", "Informatica", "SSIS", "Data Integration"],
    description:
      "Implements extract-transform-load jobs against defined mappings, usually inside an established ETL tool.",
  },
  {
    id: "etl-engineer",
    name: "ETL Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["ETL", "ELT", "Data", "Data Integration", "Data Pipelines"],
    description:
      "Owns the integration layer as a system: scheduling, retries, schema drift, and what a full reload actually costs.",
  },
  {
    id: "data-pipeline-engineer",
    name: "Data Pipeline Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data", "Data Pipelines", "ETL", "Airflow", "Orchestration"],
    description:
      "Specialises in orchestration and dependencies, so a late upstream table degrades the day rather than breaking it.",
  },
  {
    id: "data-warehouse-engineer",
    name: "Data Warehouse Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data Warehouse", "Data", "Snowflake", "BigQuery", "SQL", "ETL"],
    description:
      "Builds and tunes the warehouse itself, from partitioning and clustering to the load patterns that keep queries affordable.",
  },
  {
    id: "data-platform-engineer",
    name: "Data Platform Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data", "Data Platform", "Data Infrastructure", "Spark", "Kubernetes"],
    description:
      "Provides the shared tooling other data teams build on -- compute, catalogue, access, deployment -- as a paved road.",
  },
  {
    id: "streaming-data-engineer",
    name: "Streaming Data Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Streaming", "Kafka", "Flink", "Real Time", "Data", "Big Data"],
    description:
      "Works in unbounded data, reasoning about event time, watermarks and delivery guarantees rather than nightly batches.",
  },
  {
    id: "analytics-engineer",
    name: "Analytics Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Analytics Engineering", "dbt", "Data", "SQL", "Data Modelling"],
    description:
      "Models warehouse tables into tested, documented datasets, applying software engineering practice to analytics SQL.",
    popular: true,
  },
  {
    id: "data-infrastructure-engineer",
    name: "Data Infrastructure Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data", "Data Infrastructure", "Big Data", "Spark", "Kubernetes"],
    description:
      "Runs the clusters, storage and query engines underneath the data stack, and is on call when they stop responding.",
  },
  {
    id: "data-architect",
    name: "Data Architect",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Data", "Data Architecture", "Data Modelling", "Data Warehouse", "Architect"],
    description:
      "Decides how data is modelled and where it lives across an organisation, including which system is allowed to own what.",
  },
  {
    id: "hadoop-engineer",
    name: "Hadoop Engineer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Hadoop", "Big Data", "HDFS", "Hive", "MapReduce", "Data"],
    description:
      "Operates and develops against the Hadoop ecosystem -- HDFS, YARN, Hive -- in the estates that still run on it.",
  },
  {
    id: "spark-developer",
    name: "Spark Developer",
    categoryId: "data",
    subcategory: "Data Engineering",
    aliases: ["Spark", "PySpark", "Databricks", "Big Data", "Scala", "Data"],
    description:
      "Writes and optimises Spark jobs, where the interesting questions are shuffles, skew and how the plan actually executes.",
  },

  // --- Database ------------------------------------------------------------
  // "DBA" is attached to the administration and architecture roles only.
  // Someone typing it is looking for operations, not for query writing, so
  // matching every database entry on it would only add noise.
  {
    id: "database-administrator",
    name: "Database Administrator",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["DBA", "Database", "SQL", "Backup and Recovery", "Data"],
    description:
      "Keeps databases available and recoverable: backups, replication, upgrades, capacity, and the restore nobody rehearsed.",
    popular: true,
  },
  {
    id: "database-engineer",
    name: "Database Engineer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["Database", "DBA", "SQL", "Query Optimisation", "Data"],
    description:
      "Treats the database as an engineered system, working on schema design, query performance and automated operations.",
  },
  {
    id: "database-developer",
    name: "Database Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["Database", "SQL", "Stored Procedures", "PL/SQL", "Data"],
    description:
      "Writes the logic that lives inside the database -- procedures, views, triggers -- and the migrations that change it.",
  },
  {
    id: "sql-developer",
    name: "SQL Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["SQL", "Database", "T-SQL", "PL/SQL", "Queries", "Data"],
    description:
      "Lives in query writing and tuning, from window functions to reading an execution plan and fixing what it reveals.",
    popular: true,
  },
  {
    id: "postgresql-developer",
    name: "PostgreSQL Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["PostgreSQL", "Postgres", "SQL", "Database", "Data"],
    description:
      "Builds on Postgres specifically, using its indexing, extensions and MVCC behaviour rather than generic SQL alone.",
  },
  {
    id: "mysql-developer",
    name: "MySQL Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["MySQL", "MariaDB", "InnoDB", "SQL", "Database", "Data"],
    description:
      "Develops against MySQL or MariaDB, where schema, index and InnoDB details decide whether a query scales.",
  },
  {
    id: "mongodb-developer",
    name: "MongoDB Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["MongoDB", "Mongo", "NoSQL", "Document Database", "Database", "Data"],
    description:
      "Designs document schemas and aggregation pipelines in MongoDB, trading joins for embedding and duplication on purpose.",
  },
  {
    id: "oracle-database-developer",
    name: "Oracle Database Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["Oracle", "PL/SQL", "SQL", "Database", "Data"],
    description:
      "Works in Oracle and PL/SQL, typically inside long-lived enterprise systems that hold substantial logic in the database.",
  },
  {
    id: "nosql-developer",
    name: "NoSQL Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["NoSQL", "Cassandra", "DynamoDB", "MongoDB", "Database", "Data"],
    description:
      "Chooses and models against non-relational stores, reasoning about access patterns and consistency instead of normal forms.",
  },
  {
    id: "database-architect",
    name: "Database Architect",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["Database", "Database Architecture", "DBA", "Data Modelling", "SQL"],
    description:
      "Sets database strategy: engine selection, sharding and replication topology, and how services share or avoid sharing data.",
  },
  {
    id: "data-warehouse-developer",
    name: "Data Warehouse Developer",
    categoryId: "data",
    subcategory: "Database",
    aliases: ["Data Warehouse", "Dimensional Modelling", "SQL", "ETL", "Data"],
    description:
      "Builds the dimensional models and load jobs inside a warehouse, working in facts, dimensions and slowly changing history.",
  },

  // --- Data Governance -----------------------------------------------------
  // A small group, but the interviews look unlike the rest of Data: policy,
  // lineage and evidence rather than pipelines and models.
  {
    id: "data-quality-engineer",
    name: "Data Quality Engineer",
    categoryId: "data",
    subcategory: "Data Governance",
    aliases: ["Data", "Data Quality", "Data Validation", "Data Observability", "ETL"],
    description:
      "Builds the tests, checks and alerts that catch bad data before a dashboard quietly reports the wrong number.",
  },
  {
    id: "data-governance-analyst",
    name: "Data Governance Analyst",
    categoryId: "data",
    subcategory: "Data Governance",
    aliases: ["Data", "Data Governance", "Data Quality", "GDPR", "Compliance"],
    description:
      "Documents ownership, lineage and retention for data assets, and checks that use of personal data matches what was promised.",
  },
  {
    id: "data-governance-engineer",
    name: "Data Governance Engineer",
    categoryId: "data",
    subcategory: "Data Governance",
    aliases: ["Data", "Data Governance", "Data Catalog", "Data Lineage", "Access Control"],
    description:
      "Implements governance in code: catalogue integrations, automated lineage, and access policies the platform enforces itself.",
  },
];

/**
 * Cloud, DevOps, reliability and infrastructure roles.
 *
 * The four subcategories overlap heavily in practice and a candidate will often
 * match two of them, which is fine -- the subcategory groups the results, it
 * does not gate them. What matters more is the alias coverage: "DevOps",
 * "CI/CD" and "Docker" reach the delivery roles, the three cloud provider names
 * reach the platform-specific ones, and "K8s" and "SRE" reach the entries whose
 * full titles almost nobody types out.
 */
export const CLOUD_ROLES: Role[] = [
  // --- DevOps --------------------------------------------------------------
  // "DevOps", "CI/CD" and "Docker" go on every entry in this group: they are
  // the three words that stand in for the whole discipline in job searches.
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["DevOps", "CI/CD", "Docker", "Kubernetes", "K8s", "Cloud", "Automation"],
    description:
      "Owns how code gets from a commit to production, and the pipelines, configuration and tooling that make that repeatable.",
    suggested: true,
    popular: true,
  },
  {
    id: "senior-devops-engineer",
    name: "Senior DevOps Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["DevOps", "CI/CD", "Docker", "Kubernetes", "K8s", "Cloud"],
    description:
      "Sets delivery practice across several teams, and is judged on the rollout and rollback story as much as the pipeline itself.",
  },
  {
    id: "devsecops-engineer",
    name: "DevSecOps Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["DevSecOps", "DevOps", "CI/CD", "Docker", "Security", "Cloud"],
    description:
      "Builds security into the delivery pipeline -- scanning, secrets, signing, policy gates -- without stalling releases.",
  },
  {
    id: "release-engineer",
    name: "Release Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["DevOps", "CI/CD", "Docker", "Release Management", "Versioning"],
    description:
      "Owns the release itself: branching and versioning, what ships together, and how a bad release is backed out.",
  },
  {
    id: "build-engineer",
    name: "Build Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["DevOps", "CI/CD", "Docker", "Build Systems", "Bazel", "Developer Tooling"],
    description:
      "Keeps the build fast, reproducible and correct, which at scale is a caching and dependency-graph problem more than a scripting one.",
  },
  {
    id: "ci-cd-engineer",
    name: "CI/CD Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["CI/CD", "DevOps", "Docker", "Jenkins", "GitHub Actions", "Pipelines"],
    description:
      "Specialises in the pipeline layer, from test parallelism and flaky-job triage to deployment strategy per environment.",
  },
  {
    id: "automation-engineer",
    name: "Automation Engineer",
    categoryId: "cloud-devops",
    subcategory: "DevOps",
    aliases: ["Automation", "DevOps", "CI/CD", "Docker", "Scripting", "Ansible"],
    description:
      "Removes repeated manual operations by scripting them, then makes the resulting automation safe to run unattended.",
  },

  // --- Cloud ---------------------------------------------------------------
  // Every entry carries "Cloud". The provider-specific roles carry their own
  // provider only, while the generalist Cloud Engineer and Cloud Architect
  // carry all three -- someone searching "AWS" for a generalist role should
  // still find them.
  {
    id: "cloud-engineer",
    name: "Cloud Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "AWS", "Azure", "GCP", "Google Cloud", "Terraform"],
    description:
      "Builds and runs workloads on a public cloud, wiring together compute, networking, storage and identity as code.",
    suggested: true,
    popular: true,
  },
  {
    id: "cloud-architect",
    name: "Cloud Architect",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "AWS", "Azure", "GCP", "Google Cloud", "Architect"],
    description:
      "Designs the shape of a cloud estate -- accounts, networks, boundaries and cost model -- before anything is provisioned.",
  },
  {
    id: "cloud-solutions-architect",
    name: "Cloud Solutions Architect",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "Solutions Architect", "AWS", "Azure", "Architect"],
    description:
      "Maps a customer requirement onto cloud services, and has to justify the design commercially as well as technically.",
  },
  {
    id: "cloud-developer",
    name: "Cloud Developer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "Serverless", "Lambda", "AWS", "Azure", "Cloud Native"],
    description:
      "Writes application code that assumes managed services, working in serverless functions, queues and event-driven glue.",
  },
  {
    id: "cloud-infrastructure-engineer",
    name: "Cloud Infrastructure Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "Infrastructure", "Terraform", "IaC", "AWS", "Networking"],
    description:
      "Provisions and maintains the foundational cloud infrastructure other teams deploy onto, almost entirely through Terraform.",
  },
  {
    id: "cloud-operations-engineer",
    name: "Cloud Operations Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "CloudOps", "Operations", "Monitoring", "AWS", "On Call"],
    description:
      "Runs the estate day to day: monitoring, patching, incident handling and the cost anomalies nobody expected.",
  },
  {
    id: "aws-engineer",
    name: "AWS Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["AWS", "Amazon Web Services", "Cloud", "EC2", "Lambda", "Terraform"],
    description:
      "Works specifically in AWS, where the interview lands on IAM, VPC design and picking between overlapping services.",
    popular: true,
  },
  {
    id: "azure-engineer",
    name: "Azure Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Azure", "Microsoft Azure", "Cloud", "Entra ID", "Azure DevOps"],
    description:
      "Works specifically in Azure, usually alongside Entra ID and an existing Microsoft estate rather than on a clean slate.",
  },
  {
    id: "google-cloud-engineer",
    name: "Google Cloud Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["GCP", "Google Cloud", "Cloud", "BigQuery", "GKE"],
    description:
      "Works specifically in Google Cloud, often around GKE and BigQuery, where the data services drive the architecture.",
  },
  {
    id: "cloud-migration-engineer",
    name: "Cloud Migration Engineer",
    categoryId: "cloud-devops",
    subcategory: "Cloud",
    aliases: ["Cloud", "Cloud Migration", "Lift and Shift", "AWS", "Azure", "Modernisation"],
    description:
      "Moves existing systems onto cloud infrastructure, sequencing the cutover so the business keeps running during it.",
  },

  // --- Reliability ---------------------------------------------------------
  // "SRE" and "Site Reliability Engineer" are both listed as separate roles
  // with separate ids, because both appear as job titles and each should be
  // findable on its own terms. Both, and their neighbours, carry the "SRE" and
  // "Site Reliability" aliases so either search finds the whole group.
  {
    id: "site-reliability-engineer",
    name: "Site Reliability Engineer",
    categoryId: "cloud-devops",
    subcategory: "Reliability",
    aliases: ["SRE", "Site Reliability", "Reliability", "On Call", "Kubernetes", "K8s", "Cloud"],
    description:
      "Runs production to an explicit reliability target, spending the error budget on change and the rest on making it hold.",
    suggested: true,
    popular: true,
  },
  {
    id: "sre",
    name: "SRE",
    categoryId: "cloud-devops",
    subcategory: "Reliability",
    aliases: ["SRE", "Site Reliability", "Reliability", "On Call", "SLO", "Cloud"],
    description:
      "The abbreviated title as most companies post it, covering the same reliability, on-call and toil-reduction remit.",
  },
  {
    id: "observability-engineer",
    name: "Observability Engineer",
    categoryId: "cloud-devops",
    subcategory: "Reliability",
    aliases: ["Observability", "Monitoring", "SRE", "Site Reliability", "Prometheus", "OpenTelemetry"],
    description:
      "Builds the metrics, logs and traces that let an on-call engineer answer a question they did not anticipate.",
  },
  {
    id: "performance-engineer",
    name: "Performance Engineer",
    categoryId: "cloud-devops",
    subcategory: "Reliability",
    aliases: ["Performance", "Latency", "Profiling", "Load Testing", "SRE", "Site Reliability"],
    description:
      "Finds and removes latency and throughput bottlenecks in running systems, working from profiles rather than intuition.",
  },
  {
    id: "capacity-engineer",
    name: "Capacity Engineer",
    categoryId: "cloud-devops",
    subcategory: "Reliability",
    aliases: ["Capacity Planning", "Scaling", "SRE", "Site Reliability", "Cost Optimisation", "Cloud"],
    description:
      "Forecasts demand and provisions ahead of it, balancing headroom against the cost of capacity that sits idle.",
  },

  // --- Infrastructure ------------------------------------------------------
  // "K8s" is on every Kubernetes and container entry. It is what people type,
  // and without it a search for the most common container platform in use
  // would return nothing at all.
  {
    id: "platform-engineer",
    name: "Platform Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Platform Engineering", "Kubernetes", "K8s", "DevOps", "Cloud", "Internal Developer Platform"],
    description:
      "Builds the internal platform other engineers ship on, treating those engineers as the users of an actual product.",
    popular: true,
  },
  {
    id: "infrastructure-engineer",
    name: "Infrastructure Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Infrastructure", "IaC", "Terraform", "Cloud", "Linux", "Networking"],
    description:
      "Provisions and maintains the servers, networks and clusters everything else depends on, increasingly as declarative code.",
  },
  {
    id: "infrastructure-automation-engineer",
    name: "Infrastructure Automation Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Infrastructure", "Automation", "Terraform", "Ansible", "IaC", "Cloud"],
    description:
      "Replaces manual infrastructure work with idempotent automation, so a rebuilt environment matches the one it replaced.",
  },
  {
    id: "kubernetes-engineer",
    name: "Kubernetes Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Kubernetes", "K8s", "Containers", "Docker", "Helm", "Cloud"],
    description:
      "Operates Kubernetes clusters in anger: scheduling, networking, upgrades, and the failure modes that only appear at scale.",
    popular: true,
  },
  {
    id: "container-engineer",
    name: "Container Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Containers", "Docker", "Kubernetes", "K8s", "Container Runtime", "Cloud"],
    description:
      "Owns the container layer -- image builds, registries, runtime and isolation -- underneath whatever orchestrator runs on top.",
  },
  {
    id: "network-engineer",
    name: "Network Engineer",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Networking", "TCP/IP", "BGP", "Firewalls", "Infrastructure", "Cloud"],
    description:
      "Designs and troubleshoots the network path itself, from routing and DNS to the packet capture that settles an argument.",
  },
  {
    id: "system-administrator",
    name: "System Administrator",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["SysAdmin", "System Administration", "Infrastructure", "Linux", "Windows", "Servers"],
    description:
      "Keeps servers, accounts and services running for the people who use them, across whatever mix of platforms exists.",
  },
  {
    id: "linux-administrator",
    name: "Linux Administrator",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Linux", "SysAdmin", "Bash", "systemd", "Infrastructure", "Servers"],
    description:
      "Administers Linux systems in depth, where the interview is about processes, filesystems, systemd and diagnosing from the shell.",
  },
  {
    id: "windows-administrator",
    name: "Windows Administrator",
    categoryId: "cloud-devops",
    subcategory: "Infrastructure",
    aliases: ["Windows", "SysAdmin", "Active Directory", "PowerShell", "Infrastructure", "Servers"],
    description:
      "Administers Windows Server estates, centred on Active Directory, group policy and PowerShell-driven management.",
  },
];

/**
 * Security roles.
 *
 * Titles in this field are unusually interchangeable -- "Security Engineer",
 * "Cybersecurity Engineer" and "Information Security Engineer" often describe
 * the same job -- so all of them are listed rather than collapsed, and every
 * entry carries the four generic aliases people search with: "Security",
 * "Cybersecurity", "InfoSec" and "Cyber". The descriptions then have to earn the
 * separation, which is why they lean on what the role actually does day to day.
 */
export const SECURITY_ROLES: Role[] = [
  // --- Security Engineering ------------------------------------------------
  {
    id: "cybersecurity-engineer",
    name: "Cybersecurity Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Engineering"],
    description:
      "Builds and runs the controls that defend a company's systems, from hardening and segmentation to detection coverage.",
    suggested: true,
    popular: true,
  },
  {
    id: "security-engineer",
    name: "Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Engineering"],
    description:
      "Works alongside engineering teams to make secure the default: reviews, tooling and fixes rather than findings alone.",
  },
  {
    id: "information-security-engineer",
    name: "Information Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["InfoSec", "Information Security", "Security", "Cybersecurity", "Cyber"],
    description:
      "Protects information assets across the organisation, covering data classification, encryption and access as one programme.",
  },
  {
    id: "application-security-engineer",
    name: "Application Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["AppSec", "Application Security", "Security", "Cybersecurity", "InfoSec", "Cyber", "OWASP"],
    description:
      "Finds and prevents vulnerabilities in code, through threat modelling, code review and the scanners wired into CI.",
  },
  {
    id: "cloud-security-engineer",
    name: "Cloud Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Cloud Security", "Security", "Cybersecurity", "InfoSec", "Cyber", "AWS", "Cloud"],
    description:
      "Secures cloud estates specifically, where most real incidents trace back to identity policy and an exposed misconfiguration.",
  },
  {
    id: "network-security-engineer",
    name: "Network Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Network Security", "Security", "Cybersecurity", "InfoSec", "Cyber", "Firewalls", "VPN"],
    description:
      "Defends the network layer: firewall and VPN policy, segmentation, and inspecting traffic for what should not be there.",
  },
  {
    id: "security-operations-engineer",
    name: "Security Operations Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Security Operations", "SOC", "SecOps", "Security", "Cybersecurity", "InfoSec", "Cyber", "SIEM"],
    description:
      "Builds and maintains the detection stack the SOC works in -- SIEM pipelines, detection rules and response automation.",
  },
  {
    id: "zero-trust-security-engineer",
    name: "Zero Trust Security Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Engineering",
    aliases: ["Zero Trust", "Security", "Cybersecurity", "InfoSec", "Cyber", "Identity", "Access Management"],
    description:
      "Replaces network-perimeter trust with per-request verification, which in practice is an identity and device posture problem.",
  },

  // --- Security Analysis ---------------------------------------------------
  // "SOC" and "Security Operations" are both attached to the SOC roles: the
  // abbreviation is what candidates type, the phrase is what job specs use.
  {
    id: "cybersecurity-analyst",
    name: "Cybersecurity Analyst",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Analyst"],
    description:
      "Monitors for and investigates threats against the organisation, and reports on where the exposure actually sits.",
  },
  {
    id: "security-analyst",
    name: "Security Analyst",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Analysis"],
    description:
      "Triages alerts and assesses risk, deciding what is background noise and what warrants pulling other people in.",
    popular: true,
  },
  {
    id: "information-security-analyst",
    name: "Information Security Analyst",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["InfoSec", "Information Security", "Security", "Cybersecurity", "Cyber", "Risk"],
    description:
      "Assesses controls, policies and third parties against a standard, and tracks the gaps until somebody closes them.",
  },
  {
    id: "soc-analyst",
    name: "SOC Analyst",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["SOC", "Security Operations", "Security", "Cybersecurity", "InfoSec", "Cyber", "SIEM"],
    description:
      "Works the alert queue in a security operations centre, escalating and containing under time pressure on a rota.",
    popular: true,
  },
  {
    id: "soc-engineer",
    name: "SOC Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["SOC", "Security Operations", "Security", "Cybersecurity", "InfoSec", "Cyber", "Detection Engineering"],
    description:
      "Engineers what the SOC runs on, tuning detections and log ingestion so the queue contains signal rather than volume.",
  },
  {
    id: "vulnerability-analyst",
    name: "Vulnerability Analyst",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["Vulnerability Management", "Security", "Cybersecurity", "InfoSec", "Cyber", "CVE"],
    description:
      "Assesses scanner output and threat context to say which of thousands of findings genuinely need fixing first.",
  },
  {
    id: "vulnerability-management-engineer",
    name: "Vulnerability Management Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Analysis",
    aliases: ["Vulnerability Management", "Security", "Cybersecurity", "InfoSec", "Cyber", "Patch Management"],
    description:
      "Runs the remediation machine: asset coverage, scanning cadence, patch pipelines and evidence that fixes actually landed.",
  },

  // --- Offensive Security --------------------------------------------------
  // "Pentest", "Pen Test" and "Ethical Hacking" reach this group from every
  // direction candidates approach it from, including "Red Team".
  {
    id: "penetration-tester",
    name: "Penetration Tester",
    categoryId: "cybersecurity",
    subcategory: "Offensive Security",
    aliases: ["Pentest", "Pen Test", "Ethical Hacking", "Red Team", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Attacks systems under a defined scope and writes up how they broke, with enough detail for someone to reproduce it.",
    popular: true,
  },
  {
    id: "ethical-hacker",
    name: "Ethical Hacker",
    categoryId: "cybersecurity",
    subcategory: "Offensive Security",
    aliases: ["Ethical Hacking", "Pentest", "Pen Test", "Red Team", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Uses attacker technique with permission, often across bug bounty and assessment work rather than a fixed engagement.",
  },
  {
    id: "red-team-engineer",
    name: "Red Team Engineer",
    categoryId: "cybersecurity",
    subcategory: "Offensive Security",
    aliases: ["Red Team", "Adversary Emulation", "Pentest", "Ethical Hacking", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Emulates a specific adversary over a long campaign, where staying undetected matters as much as getting in.",
  },
  {
    id: "threat-hunter",
    name: "Threat Hunter",
    categoryId: "cybersecurity",
    subcategory: "Offensive Security",
    aliases: ["Threat Hunting", "Security", "Cybersecurity", "InfoSec", "Cyber", "Detection", "SOC"],
    description:
      "Searches proactively for intrusions no alert fired on, starting from a hypothesis about how an attacker would behave.",
  },
  {
    id: "threat-intelligence-analyst",
    name: "Threat Intelligence Analyst",
    categoryId: "cybersecurity",
    subcategory: "Offensive Security",
    aliases: ["Threat Intelligence", "CTI", "Security", "Cybersecurity", "InfoSec", "Cyber", "MITRE ATT&CK"],
    description:
      "Tracks actors, tooling and campaigns, and turns that into detections and decisions rather than a newsletter.",
  },

  // --- Incident & Forensics ------------------------------------------------
  {
    id: "incident-response-analyst",
    name: "Incident Response Analyst",
    categoryId: "cybersecurity",
    subcategory: "Incident & Forensics",
    aliases: ["Incident Response", "IR", "Security", "Cybersecurity", "InfoSec", "Cyber", "SOC"],
    description:
      "Handles confirmed incidents from containment to recovery, keeping a timeline that survives later scrutiny.",
  },
  {
    id: "incident-response-engineer",
    name: "Incident Response Engineer",
    categoryId: "cybersecurity",
    subcategory: "Incident & Forensics",
    aliases: ["Incident Response", "IR", "Security", "Cybersecurity", "InfoSec", "Cyber", "Automation"],
    description:
      "Builds the tooling and playbooks response depends on, so evidence collection and containment are not improvised mid-incident.",
  },
  {
    id: "digital-forensics-analyst",
    name: "Digital Forensics Analyst",
    categoryId: "cybersecurity",
    subcategory: "Incident & Forensics",
    aliases: ["Digital Forensics", "DFIR", "Forensics", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Reconstructs what happened from disk, memory and log artefacts, under chain-of-custody rules that make the findings usable.",
  },

  // --- Security Architecture -----------------------------------------------
  // "IAM Engineer" and "Identity and Access Management Engineer" are the same
  // job posted two ways, and both are listed so either search lands. All four
  // identity-related aliases sit on both.
  {
    id: "security-architect",
    name: "Security Architect",
    categoryId: "cybersecurity",
    subcategory: "Security Architecture",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Architecture", "Architect"],
    description:
      "Sets the security design of systems before they are built, including which trade-offs the business has agreed to accept.",
  },
  {
    id: "cybersecurity-architect",
    name: "Cybersecurity Architect",
    categoryId: "cybersecurity",
    subcategory: "Security Architecture",
    aliases: ["Security", "Cybersecurity", "InfoSec", "Cyber", "Security Architecture", "Architect"],
    description:
      "Designs defence across an entire estate, choosing the control set and how the pieces fail over when one is bypassed.",
  },
  {
    id: "identity-and-access-management-engineer",
    name: "Identity and Access Management Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Architecture",
    aliases: ["IAM", "Identity", "Access Management", "SSO", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Builds how people and services prove who they are and what they may reach: SSO, provisioning, roles and reviews.",
  },
  {
    id: "iam-engineer",
    name: "IAM Engineer",
    categoryId: "cybersecurity",
    subcategory: "Security Architecture",
    aliases: ["IAM", "Identity", "Access Management", "Okta", "Entra ID", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "The abbreviated title as most companies post it, usually centred on one identity provider and its integrations.",
  },

  // --- Governance & Compliance ---------------------------------------------
  {
    id: "grc-analyst",
    name: "GRC Analyst",
    categoryId: "cybersecurity",
    subcategory: "Governance & Compliance",
    aliases: ["GRC", "Governance Risk and Compliance", "Risk", "Security", "Cybersecurity", "InfoSec", "Cyber"],
    description:
      "Runs governance, risk and compliance as one process: risk register, control ownership, and the audits that test both.",
  },
  {
    id: "security-compliance-analyst",
    name: "Security Compliance Analyst",
    categoryId: "cybersecurity",
    subcategory: "Governance & Compliance",
    aliases: ["Compliance", "ISO 27001", "SOC 2", "Security", "Cybersecurity", "InfoSec", "Cyber", "Audit"],
    description:
      "Maps controls to a specific framework such as ISO 27001 or SOC 2, and gathers the evidence an auditor will ask for.",
  },
];

/**
 * Testing and quality roles.
 *
 * Search here is dominated by two-and-three letter forms -- "QA", "SDET" -- so
 * every entry carries "QA", "Testing", "Test" and "Quality Assurance", and the
 * automation group additionally carries "Automation" and "Test Automation".
 * The split between manual quality work, automation, and the specialised kinds
 * of testing matters because the interviews differ sharply: one is about test
 * design and judgement, the next about writing maintainable framework code.
 */
export const TESTING_ROLES: Role[] = [
  // --- Quality Assurance ---------------------------------------------------
  {
    id: "qa-engineer",
    name: "QA Engineer",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Software Testing"],
    description:
      "Owns quality for a product area, designing the test coverage and deciding whether a release is fit to go out.",
    suggested: true,
    popular: true,
  },
  {
    id: "qa-analyst",
    name: "QA Analyst",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Test Cases"],
    description:
      "Works from requirements to test cases and defect reports, and is measured on the bugs that reach production instead.",
  },
  {
    id: "software-test-engineer",
    name: "Software Test Engineer",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Test Engineer"],
    description:
      "Tests software across levels -- unit through system -- and builds the harnesses that make deeper testing possible.",
  },
  {
    id: "software-tester",
    name: "Software Tester",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Tester"],
    description:
      "Executes and evolves test suites against builds, and reports defects with the reproduction steps developers need.",
  },
  {
    id: "manual-tester",
    name: "Manual Tester",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Manual Testing", "Exploratory Testing"],
    description:
      "Tests by hand and exploratorily, catching the usability and edge-case problems an automated suite was never told to look for.",
  },
  {
    id: "quality-engineer",
    name: "Quality Engineer",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Quality Engineering"],
    description:
      "Improves how quality is built in rather than inspected afterwards, working on process and tooling as much as on tests.",
  },
  {
    id: "qa-lead",
    name: "QA Lead",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "Test Lead"],
    description:
      "Leads a testing team through a release, owning the test strategy, the coverage argument and the sign-off call.",
  },
  {
    id: "quality-assurance-manager",
    name: "Quality Assurance Manager",
    categoryId: "testing",
    subcategory: "Quality Assurance",
    aliases: ["QA", "Testing", "Test", "Quality Assurance", "QA Manager"],
    description:
      "Manages the quality function: people, budget, tooling choices, and the metrics reported upward about release health.",
  },

  // --- Test Automation -----------------------------------------------------
  // The tool-named roles carry their tool, because that is how these jobs are
  // advertised and how candidates search for them.
  {
    id: "automation-test-engineer",
    name: "Automation Test Engineer",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["Automation", "Test Automation", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Converts manual regression into reliable automated suites, and keeps them from becoming the flaky job everyone reruns.",
    popular: true,
  },
  {
    id: "sdet",
    name: "SDET",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["SDET", "Test Automation", "Automation", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "A developer whose product is the test infrastructure: frameworks, fixtures and harnesses other engineers build on.",
    popular: true,
  },
  {
    id: "test-automation-engineer",
    name: "Test Automation Engineer",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["Test Automation", "Automation", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Designs and maintains the automation layer end to end, including what belongs in CI and what is too slow to live there.",
  },
  {
    id: "qa-automation-engineer",
    name: "QA Automation Engineer",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["QA", "Test Automation", "Automation", "Testing", "Test", "Quality Assurance"],
    description:
      "Sits inside a QA team writing automated checks, splitting time between new coverage and diagnosing failing runs.",
  },
  {
    id: "selenium-tester",
    name: "Selenium Tester",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["Selenium", "WebDriver", "Test Automation", "Automation", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Automates browser testing with Selenium, where locator strategy and waiting correctly decide whether the suite is trusted.",
  },
  {
    id: "playwright-tester",
    name: "Playwright Tester",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["Playwright", "Test Automation", "Automation", "E2E Testing", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Builds end-to-end suites in Playwright, leaning on its auto-waiting, tracing and parallel execution model.",
  },
  {
    id: "cypress-tester",
    name: "Cypress Tester",
    categoryId: "testing",
    subcategory: "Test Automation",
    aliases: ["Cypress", "Test Automation", "Automation", "E2E Testing", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Writes front-end tests in Cypress, working inside the browser runtime with network stubbing and component testing.",
  },

  // --- Specialised Testing -------------------------------------------------
  {
    id: "performance-test-engineer",
    name: "Performance Test Engineer",
    categoryId: "testing",
    subcategory: "Specialised Testing",
    aliases: ["Performance Testing", "Load Testing", "JMeter", "k6", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Designs load and stress tests that model real traffic, then reads the results well enough to name the bottleneck.",
  },
  {
    id: "api-test-engineer",
    name: "API Test Engineer",
    categoryId: "testing",
    subcategory: "Specialised Testing",
    aliases: ["API Testing", "REST", "Postman", "Contract Testing", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Tests services at the contract level -- schemas, status codes, versioning -- where a UI test would be slower and vaguer.",
  },
  {
    id: "mobile-test-engineer",
    name: "Mobile Test Engineer",
    categoryId: "testing",
    subcategory: "Specialised Testing",
    aliases: ["Mobile Testing", "Appium", "Android", "iOS", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Tests iOS and Android apps across a device matrix, including the offline, permission and upgrade paths people actually hit.",
  },
  {
    id: "security-test-engineer",
    name: "Security Test Engineer",
    categoryId: "testing",
    subcategory: "Specialised Testing",
    aliases: ["Security Testing", "SAST", "DAST", "Security", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Tests specifically for security defects, wiring SAST and DAST into the pipeline and validating what the tools report.",
  },
  {
    id: "test-architect",
    name: "Test Architect",
    categoryId: "testing",
    subcategory: "Specialised Testing",
    aliases: ["Test Strategy", "Test Automation", "QA", "Testing", "Test", "Quality Assurance", "Architect"],
    description:
      "Sets the testing strategy across teams: which layer each check belongs in, and what the suite is deliberately not covering.",
  },

  // --- AI Testing ----------------------------------------------------------
  // New enough that the titles are not settled, which is exactly why both
  // variants are listed rather than a guess at the winning one.
  {
    id: "ai-testing-engineer",
    name: "AI Testing Engineer",
    categoryId: "testing",
    subcategory: "AI Testing",
    aliases: ["AI Testing", "LLM Testing", "Model Evaluation", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Tests systems whose output is not deterministic, building evaluation sets and thresholds in place of exact assertions.",
  },
  {
    id: "ai-qa-engineer",
    name: "AI QA Engineer",
    categoryId: "testing",
    subcategory: "AI Testing",
    aliases: ["AI QA", "AI Testing", "LLM", "Evals", "QA", "Testing", "Test", "Quality Assurance"],
    description:
      "Runs quality assurance for AI features, covering hallucination, safety and regression checks across model versions.",
  },
];
