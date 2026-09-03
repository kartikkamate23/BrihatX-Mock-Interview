/**
 * The Software slice of the role catalogue.
 *
 * Why one "Software" category and not five
 * ----------------------------------------
 * Frontend, backend, mobile, embedded and the rest are `subcategory` values here
 * rather than categories of their own, and that is a deliberate limit on the tab
 * strip. A tab strip is a navigation aid: it works when a glance is enough to
 * pick one. Promote every family in this file to its own tab and the picker ends
 * up with twenty tabs, which is a list with extra steps -- the candidate now has
 * to scan a horizontal list *and then* a vertical one. Subcategories cost
 * nothing by comparison, because they group results inside a tab without asking
 * anyone to make a decision first: someone who lands on Software sees Frontend,
 * Backend and Mobile as headings on one screen, already sorted.
 *
 * The other half of the argument is that the boundaries are not real. A Next.js
 * developer is a frontend role until the API routes show up; a React Native
 * developer is mobile by platform and frontend by daily work. Any tab layout
 * forces a single answer to that question and then makes the candidate guess
 * which answer we picked. Grouping inside one tab lets them find the role from
 * either direction.
 *
 * Why the aliases are doing the real work
 * ---------------------------------------
 * People do not search by job title. They search by the technology they know:
 * "React", "Java", "Golang", "Spring", "MERN", "Solidity". None of those strings
 * appear in a title like "Frontend Engineer" or "Full Stack Developer", so a
 * name-only search returns nothing for exactly the queries candidates are most
 * likely to type, which reads as "this product does not cover my stack".
 *
 * So the aliases carry the search load, and they are written for the way a real
 * person spells a thing rather than the canonical way: "Node", "NodeJS" and
 * "Node.js" are three keystroke habits for one runtime, and so are "Frontend",
 * "Front End" and "Front-End". Abbreviations that mostly exist in speech ("SWE",
 * "RN", "a11y", "RoR") are here for the same reason.
 *
 * What aliases are not is padding. Every entry below is something a person would
 * plausibly type into a search box. Noise here does not merely waste bytes, it
 * pulls the wrong role to the top of an unrelated search.
 *
 * Pure data, no logic. Search, grouping and ranking all read this file instead
 * of each keeping a copy of the list.
 */

import type { Role } from "@/lib/roles/types";

export const SOFTWARE_ROLES: Role[] = [
  // ---------------------------------------------------------------------------
  // Software Engineering
  //
  // The stack-agnostic titles, plus the seniority ladder and the architect
  // track. The seniority variants are separate entries rather than a level
  // dropdown, because they are genuinely different interviews -- a Staff loop is
  // mostly scope and influence -- and because people search for the title they
  // are being hired into.
  // ---------------------------------------------------------------------------
  {
    id: "software-engineer",
    name: "Software Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SWE", "SDE", "Software Developer", "Programmer", "Coder"],
    description:
      "The general engineering loop: data structures, algorithms, and building something that works under time pressure.",
    suggested: true,
    popular: true,
  },
  {
    id: "software-developer",
    name: "Software Developer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SWE", "Software Engineer", "Developer", "Programmer"],
    description:
      "Writing and shipping application code day to day, with the weight on delivery rather than on system design.",
    popular: true,
  },
  {
    id: "application-developer",
    name: "Application Developer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["App Developer", "Applications Developer", "Business Applications"],
    description:
      "Building and extending the business applications a company runs on, usually inside an existing codebase with existing users.",
  },
  {
    id: "systems-software-developer",
    name: "Systems Software Developer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Systems Programming", "Systems Developer", "Low Level", "OS Development"],
    description:
      "Work close to the machine -- operating systems, runtimes, compilers, drivers -- where memory and scheduling are the problem.",
  },
  {
    id: "senior-software-engineer",
    name: "Senior Software Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SWE", "Software Engineer", "Senior SWE", "SDE 3", "Senior Developer"],
    description:
      "Owning a feature area end to end: design decisions you can defend, and unblocking the people working around you.",
    popular: true,
  },
  {
    id: "staff-software-engineer",
    name: "Staff Software Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SWE", "Software Engineer", "Staff Engineer", "Tech Lead"],
    description:
      "Technical direction across several teams, where the interview is mostly about scope, influence, and the calls that went wrong.",
  },
  {
    id: "principal-software-engineer",
    name: "Principal Software Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SWE", "Software Engineer", "Principal Engineer", "Distinguished Engineer"],
    description:
      "Org-wide technical judgement: multi-year architecture bets, and knowing which problems are not worth solving at all.",
  },
  {
    id: "solutions-engineer",
    name: "Solutions Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Sales Engineer", "Pre-Sales Engineer", "Customer Engineer", "SE"],
    description:
      "Sitting between the product and the customer, proving technical fit in a live demo and carrying requirements back to engineering.",
  },
  {
    id: "integration-engineer",
    name: "Integration Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Systems Integration", "Middleware Engineer", "Integrations", "ETL"],
    description:
      "Making systems that were never designed for each other talk reliably, including the retries and reconciliation nobody budgets for.",
  },
  {
    id: "api-developer",
    name: "API Developer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["API", "REST", "REST API Developer", "GraphQL", "OpenAPI"],
    description:
      "Designing and shipping the HTTP surface other teams build against, where a versioning mistake is effectively permanent.",
  },
  {
    id: "sdk-developer",
    name: "SDK Developer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SDK", "Client Library", "Developer Tooling", "Platform SDK"],
    description:
      "Building the client libraries other developers install, where ergonomics and backwards compatibility are the product.",
  },
  {
    id: "application-engineer",
    name: "Application Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["App Engineer", "Applications Engineer", "Product Engineer"],
    description:
      "Product-facing engineering: shipping user-visible features and owning how they behave once real people touch them.",
  },
  {
    id: "software-architect",
    name: "Software Architect",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Architect", "Application Architect", "System Design"],
    description:
      "Choosing the structure a codebase has to live inside for years, and justifying it against the alternatives you rejected.",
    popular: true,
  },
  {
    id: "solutions-architect",
    name: "Solutions Architect",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["SA", "Architect", "Cloud Solutions Architect", "Enterprise Solutions"],
    description:
      "Assembling a working solution for one customer out of existing platforms and vendors, with cost as a first-class constraint.",
  },
  {
    id: "technical-architect",
    name: "Technical Architect",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Tech Architect", "Architect", "Enterprise Architect", "Technical Lead"],
    description:
      "Owning standards and technology choices across an organisation, including the migrations required to actually get there.",
  },
  {
    id: "distributed-systems-engineer",
    name: "Distributed Systems Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Distributed Systems", "Consensus", "Scalability", "Consistency"],
    description:
      "Systems spread across machines, where partial failure, ordering and consistency are the entire conversation.",
  },
  {
    id: "microservices-engineer",
    name: "Microservices Engineer",
    categoryId: "software",
    subcategory: "Software Engineering",
    aliases: ["Microservices", "Service Oriented Architecture", "gRPC", "Service Mesh"],
    description:
      "Splitting and running services independently, and living with the boundaries, contracts and extra latency that creates.",
  },

  // ---------------------------------------------------------------------------
  // Frontend
  //
  // Every role here carries "Frontend", "Front End", "Front-End" and "UI",
  // because the same discipline is spelled four ways and a candidate should not
  // have to guess ours. Framework roles additionally carry the framework, which
  // is what they will actually type.
  // ---------------------------------------------------------------------------
  {
    id: "frontend-developer",
    name: "Frontend Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["Frontend", "Front End", "Front-End", "UI", "Front End Developer", "Client Side"],
    description:
      "Turning designs into working interfaces in the browser, with HTML, CSS and JavaScript as the daily tools.",
    suggested: true,
    popular: true,
  },
  {
    id: "frontend-engineer",
    name: "Frontend Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["Frontend", "Front End", "Front-End", "UI", "FE Engineer", "Client Side"],
    description:
      "The engineering side of the browser: state management, rendering behaviour, bundle size and how the app degrades.",
  },
  {
    id: "react-developer",
    name: "React Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["React", "ReactJS", "React.js", "Hooks", "Frontend", "Front End", "Front-End", "UI"],
    description:
      "Building interfaces in React: components, hooks, and keeping renders predictable as the tree grows.",
    suggested: true,
    popular: true,
  },
  {
    id: "react-engineer",
    name: "React Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["React", "ReactJS", "React.js", "Frontend", "Front End", "Front-End", "UI"],
    description:
      "React at application scale: data fetching boundaries, memoisation, and architecture choices a whole team inherits.",
  },
  {
    id: "nextjs-developer",
    name: "Next.js Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "Next.js",
      "NextJS",
      "Next",
      "React",
      "ReactJS",
      "React.js",
      "SSR",
      "Frontend",
      "Front End",
      "Front-End",
      "UI",
    ],
    description:
      "React under a framework: routing, server and client components, and deciding where each piece of rendering happens.",
  },
  {
    id: "angular-developer",
    name: "Angular Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "Angular",
      "AngularJS",
      "RxJS",
      "TypeScript",
      "Frontend",
      "Front End",
      "Front-End",
      "UI",
    ],
    description:
      "Angular applications built on modules, dependency injection and RxJS streams, typically in a long-lived enterprise codebase.",
  },
  {
    id: "vuejs-developer",
    name: "Vue.js Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["Vue", "VueJS", "Vue.js", "Nuxt", "Frontend", "Front End", "Front-End", "UI"],
    description:
      "Vue single-file components and its reactivity system, often with Nuxt handling routing and rendering.",
  },
  {
    id: "javascript-developer",
    name: "JavaScript Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["JavaScript", "JS", "ES6", "Vanilla JS", "Frontend", "Front End", "Front-End", "UI"],
    description:
      "The language itself: closures, the event loop, async behaviour and the parts of the DOM that frameworks hide.",
  },
  {
    id: "typescript-developer",
    name: "TypeScript Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: ["TypeScript", "TS", "JavaScript", "Types", "Frontend", "Front End", "Front-End", "UI"],
    description:
      "Using the type system as a design tool: generics, narrowing, and making illegal states impossible to represent.",
    popular: true,
  },
  {
    id: "web-developer",
    name: "Web Developer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "HTML",
      "CSS",
      "JavaScript",
      "Website Developer",
      "Frontend",
      "Front End",
      "Front-End",
      "UI",
    ],
    description:
      "Building and maintaining websites end to end, from markup and styling through to getting the thing live.",
    popular: true,
  },
  {
    id: "ui-engineer",
    name: "UI Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "UI",
      "User Interface Engineer",
      "Design Systems",
      "Component Library",
      "Frontend",
      "Front End",
      "Front-End",
    ],
    description:
      "The component layer as a product: a design system that stays consistent, accessible and reusable across teams.",
  },
  {
    id: "web-performance-engineer",
    name: "Web Performance Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "Web Performance",
      "Core Web Vitals",
      "Page Speed",
      "Lighthouse",
      "Frontend",
      "Front End",
      "Front-End",
      "UI",
    ],
    description:
      "Making pages measurably faster: load waterfalls, render blocking, bundle budgets and the metrics users actually feel.",
  },
  {
    id: "accessibility-engineer",
    name: "Accessibility Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "Accessibility",
      "a11y",
      "WCAG",
      "Screen Reader",
      "ARIA",
      "Frontend",
      "Front End",
      "Front-End",
      "UI",
    ],
    description:
      "Making interfaces work for assistive technology, from semantics and focus order to auditing against WCAG.",
  },
  {
    id: "design-engineer",
    name: "Design Engineer",
    categoryId: "software",
    subcategory: "Frontend",
    aliases: [
      "UX Engineer",
      "Design Systems",
      "Prototyping",
      "UI",
      "Frontend",
      "Front End",
      "Front-End",
    ],
    description:
      "The seam between design and code: prototyping in the browser, motion, and taste about how an interface should feel.",
  },

  // ---------------------------------------------------------------------------
  // Backend
  //
  // Language and framework roles dominate here because that is how these jobs
  // are advertised and how candidates search. Framework entries carry the parent
  // language too -- somebody searching "Python" should find the Django and
  // FastAPI roles, not just the generic one.
  // ---------------------------------------------------------------------------
  {
    id: "backend-developer",
    name: "Backend Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Backend", "Back End", "Back-End", "Server Side", "Backend Development"],
    description:
      "Server-side work: endpoints, database access and the business logic behind whatever the user sees.",
    suggested: true,
    popular: true,
  },
  {
    id: "backend-engineer",
    name: "Backend Engineer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Backend", "Back End", "Back-End", "BE Engineer", "Server Side"],
    description:
      "Backend systems under load: schema design, caching, queues, and what happens when a dependency stops responding.",
  },
  {
    id: "nodejs-developer",
    name: "Node.js Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: [
      "Node",
      "NodeJS",
      "Node.js",
      "Express",
      "JavaScript",
      "Backend",
      "Back End",
      "Back-End",
    ],
    description:
      "Services on Node: the event loop, streams, async control flow, and the npm dependency tree that comes with it.",
    popular: true,
  },
  {
    id: "java-developer",
    name: "Java Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Java", "JVM", "J2EE", "Core Java", "Backend", "Back End", "Back-End"],
    description:
      "Java services with the collections API, concurrency primitives and JVM behaviour all fair game in the interview.",
    suggested: true,
    popular: true,
  },
  {
    id: "spring-boot-developer",
    name: "Spring Boot Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: [
      "Spring",
      "Spring Boot",
      "Java",
      "JVM",
      "Hibernate",
      "Backend",
      "Back End",
      "Back-End",
    ],
    description:
      "Java services built the Spring way: dependency injection, JPA, and the annotation behaviour you are expected to explain.",
  },
  {
    id: "python-developer",
    name: "Python Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Python", "Py", "Python3", "Backend", "Back End", "Back-End"],
    description:
      "Python for services and tooling, including the idioms, the standard library, and where the GIL actually bites.",
    suggested: true,
    popular: true,
  },
  {
    id: "django-developer",
    name: "Django Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Django", "Python", "DRF", "Django REST Framework", "Backend", "Back End", "Back-End"],
    description:
      "Django applications: the ORM and its query traps, migrations, and building APIs with Django REST Framework.",
  },
  {
    id: "flask-developer",
    name: "Flask Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Flask", "Python", "Jinja", "WSGI", "Backend", "Back End", "Back-End"],
    description:
      "Small, explicit Python services in Flask, where you assemble the extensions and structure the framework does not impose.",
  },
  {
    id: "fastapi-developer",
    name: "FastAPI Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["FastAPI", "Python", "Pydantic", "async", "Backend", "Back End", "Back-End"],
    description:
      "Async Python APIs with typed request models, dependency injection and schemas generated from the code.",
  },
  {
    id: "dotnet-developer",
    name: ".NET Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: [
      "dotnet",
      ".NET",
      "C#",
      "CSharp",
      "ASP.NET",
      "Entity Framework",
      "Backend",
      "Back End",
      "Back-End",
    ],
    description:
      "Services on the .NET platform: ASP.NET Core, Entity Framework, and async and LINQ used the way the runtime expects.",
    popular: true,
  },
  {
    id: "csharp-developer",
    name: "C# Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["C#", "CSharp", "dotnet", ".NET", "Backend", "Back End", "Back-End"],
    description:
      "The C# language itself -- generics, LINQ, async/await, memory behaviour -- across services, desktop apps or game code.",
  },
  {
    id: "php-developer",
    name: "PHP Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["PHP", "Composer", "PHP8", "Backend", "Back End", "Back-End"],
    description:
      "PHP applications, from modern typed codebases to the legacy systems that still handle most of the traffic.",
  },
  {
    id: "laravel-developer",
    name: "Laravel Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Laravel", "PHP", "Eloquent", "Blade", "Backend", "Back End", "Back-End"],
    description:
      "Laravel applications: Eloquent relationships, queues, middleware, and the conventions the framework rewards.",
  },
  {
    id: "go-developer",
    name: "Go Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Go", "Golang", "Goroutines", "Backend", "Back End", "Back-End"],
    description:
      "Go services where goroutines, channels and explicit error handling are the interview, not an implementation detail.",
  },
  {
    id: "golang-developer",
    name: "Golang Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Golang", "Go", "Goroutines", "Backend", "Back End", "Back-End"],
    description:
      "The same work under the name most job posts use: concurrent Go backends, interfaces, and a deliberately small standard toolkit.",
  },
  {
    id: "rust-developer",
    name: "Rust Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Rust", "Ownership", "Borrow Checker", "Systems Programming", "Backend", "Back End", "Back-End"],
    description:
      "Rust where the borrow checker is the design constraint: ownership, lifetimes, and safety without a garbage collector.",
  },
  {
    id: "ruby-developer",
    name: "Ruby Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Ruby", "RubyGems", "Backend", "Back End", "Back-End"],
    description:
      "Ruby as a language: blocks, metaprogramming, and writing code that reads well without becoming unmaintainable magic.",
  },
  {
    id: "ruby-on-rails-developer",
    name: "Ruby on Rails Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Rails", "Ruby on Rails", "RoR", "Ruby", "ActiveRecord", "Backend", "Back End", "Back-End"],
    description:
      "Rails applications built on convention: ActiveRecord, background jobs, and keeping a mature monolith healthy.",
  },
  {
    id: "cpp-developer",
    name: "C++ Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["C++", "CPP", "STL", "Modern C++", "Systems Programming", "Backend", "Back End", "Back-End"],
    description:
      "Performance-critical C++: RAII, move semantics, templates, and knowing exactly what the code costs at runtime.",
  },
  {
    id: "api-engineer",
    name: "API Engineer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["API", "REST", "GraphQL", "gRPC", "Backend", "Back End", "Back-End"],
    description:
      "APIs as infrastructure: authentication, rate limiting, pagination, and evolving a contract without breaking clients.",
  },
  {
    id: "scala-developer",
    name: "Scala Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Scala", "JVM", "Akka", "Functional Programming", "Spark", "Backend", "Back End", "Back-End"],
    description:
      "Scala on the JVM, where functional style, the type system and data-heavy pipelines usually come together.",
  },
  {
    id: "elixir-developer",
    name: "Elixir Developer",
    categoryId: "software",
    subcategory: "Backend",
    aliases: ["Elixir", "Phoenix", "Erlang", "BEAM", "OTP", "Backend", "Back End", "Back-End"],
    description:
      "Elixir on the BEAM: OTP supervision trees, processes by the million, and systems designed to let things crash.",
  },

  // ---------------------------------------------------------------------------
  // Full Stack
  //
  // Stack acronyms are how these jobs are posted, so each variant carries both
  // the acronym and every technology it expands to. Somebody searching
  // "MongoDB" should find MERN even though the letters never spell it out.
  // ---------------------------------------------------------------------------
  {
    id: "full-stack-developer",
    name: "Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: ["Fullstack", "Full-Stack", "Full Stack", "Frontend", "Backend", "End to End"],
    description:
      "Owning a feature from the interface to the database, and being fluent enough on both sides to debug across them.",
    suggested: true,
    popular: true,
  },
  {
    id: "full-stack-engineer",
    name: "Full Stack Engineer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: ["Fullstack", "Full-Stack", "Full Stack", "Frontend", "Backend", "Product Engineer"],
    description:
      "Full stack with the design questions attached: where a boundary belongs, what to cache, and which layer should own state.",
  },
  {
    id: "mern-stack-developer",
    name: "MERN Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "MERN",
      "MongoDB",
      "Express",
      "React",
      "Node",
      "NodeJS",
      "Node.js",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "JavaScript on both ends: MongoDB and Express behind a React interface, with one language across the whole app.",
  },
  {
    id: "mean-stack-developer",
    name: "MEAN Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "MEAN",
      "MongoDB",
      "Express",
      "Angular",
      "Node",
      "NodeJS",
      "Node.js",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "The same JavaScript stack with Angular on the front, which brings TypeScript and a stricter application structure.",
  },
  {
    id: "pern-stack-developer",
    name: "PERN Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "PERN",
      "PostgreSQL",
      "Postgres",
      "Express",
      "React",
      "Node",
      "NodeJS",
      "Node.js",
      "SQL",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "React and Node over PostgreSQL, so relational modelling and SQL come into the interview alongside the JavaScript.",
  },
  {
    id: "java-full-stack-developer",
    name: "Java Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: ["Java", "Spring", "Spring Boot", "React", "Angular", "Fullstack", "Full-Stack", "Full Stack"],
    description:
      "A Spring backend with a JavaScript frontend, the standard enterprise pairing and the standard enterprise interview.",
  },
  {
    id: "python-full-stack-developer",
    name: "Python Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: ["Python", "Django", "Flask", "FastAPI", "React", "Fullstack", "Full-Stack", "Full Stack"],
    description:
      "Django or FastAPI on the server with a modern frontend on top, plus the templating-to-SPA decision that comes with it.",
  },
  {
    id: "dotnet-full-stack-developer",
    name: ".NET Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "dotnet",
      ".NET",
      "C#",
      "CSharp",
      "ASP.NET",
      "Blazor",
      "React",
      "Angular",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "ASP.NET Core services paired with Angular, React or Blazor, usually inside a Microsoft-shaped toolchain.",
  },
  {
    id: "react-full-stack-developer",
    name: "React Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "React",
      "ReactJS",
      "React.js",
      "Node",
      "NodeJS",
      "Node.js",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "React on the client with a JavaScript API behind it, where the interesting questions are about the seam between them.",
  },
  {
    id: "nextjs-full-stack-developer",
    name: "Next.js Full Stack Developer",
    categoryId: "software",
    subcategory: "Full Stack",
    aliases: [
      "Next.js",
      "NextJS",
      "Next",
      "React",
      "ReactJS",
      "React.js",
      "Server Actions",
      "Fullstack",
      "Full-Stack",
      "Full Stack",
    ],
    description:
      "One Next.js codebase serving both halves, so server components, server actions and caching are the whole architecture.",
  },

  // ---------------------------------------------------------------------------
  // Mobile
  //
  // Platform aliases matter more than titles here: an Android search should find
  // the Kotlin role and vice versa, because in practice they are the same job
  // advertised by different recruiters.
  // ---------------------------------------------------------------------------
  {
    id: "android-developer",
    name: "Android Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Android", "Kotlin", "Java", "Jetpack Compose", "Mobile", "Play Store"],
    description:
      "Android applications: activity and fragment lifecycles, Jetpack libraries, and shipping across a very wide device range.",
    popular: true,
  },
  {
    id: "android-engineer",
    name: "Android Engineer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Android", "Kotlin", "Jetpack Compose", "Coroutines", "Mobile"],
    description:
      "Android at app scale: module boundaries, coroutines and concurrency, startup time and memory on real hardware.",
  },
  {
    id: "ios-developer",
    name: "iOS Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["iOS", "Swift", "iPhone", "SwiftUI", "UIKit", "Mobile", "App Store"],
    description:
      "iPhone and iPad applications in Swift, with UIKit or SwiftUI and the App Store review process at the end of it.",
    popular: true,
  },
  {
    id: "ios-engineer",
    name: "iOS Engineer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["iOS", "Swift", "SwiftUI", "Concurrency", "Mobile"],
    description:
      "iOS with the systems questions attached: memory and retain cycles, structured concurrency, and app architecture at scale.",
  },
  {
    id: "flutter-developer",
    name: "Flutter Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Flutter", "Dart", "Cross Platform", "Mobile", "Widgets"],
    description:
      "One Dart codebase rendering its own widgets on both platforms, with state management as the recurring design question.",
    popular: true,
  },
  {
    id: "react-native-developer",
    name: "React Native Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["React Native", "RN", "React", "JavaScript", "Expo", "Cross Platform", "Mobile"],
    description:
      "React that renders native components, including the bridge, native modules, and the parts that still need platform code.",
  },
  {
    id: "kotlin-developer",
    name: "Kotlin Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Kotlin", "Android", "Coroutines", "JVM", "Kotlin Multiplatform", "Mobile"],
    description:
      "Kotlin as the language: null safety, coroutines and idiomatic style, on Android or on the server.",
  },
  {
    id: "swift-developer",
    name: "Swift Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Swift", "iOS", "SwiftUI", "Xcode", "Mobile"],
    description:
      "Swift as the language: optionals, protocols, value semantics, and the safety guarantees the compiler enforces.",
  },
  {
    id: "mobile-application-developer",
    name: "Mobile Application Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Mobile", "Mobile App Developer", "Android", "iOS", "App Developer"],
    description:
      "Mobile apps without a platform commitment: offline behaviour, permissions, push notifications and release cycles.",
    popular: true,
  },
  {
    id: "mobile-ui-engineer",
    name: "Mobile UI Engineer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Mobile", "UI", "Android", "iOS", "Animation", "Mobile Frontend"],
    description:
      "The visible layer of a mobile app: layout across screen sizes, gesture handling, animation, and a steady frame rate.",
  },
  {
    id: "cross-platform-mobile-developer",
    name: "Cross-Platform Mobile Developer",
    categoryId: "software",
    subcategory: "Mobile",
    aliases: ["Cross Platform", "Flutter", "React Native", "Mobile", "Hybrid App"],
    description:
      "Sharing one codebase across iOS and Android, and judging when a platform difference is worth dropping to native for.",
  },

  // ---------------------------------------------------------------------------
  // Embedded & IoT
  //
  // Hardware, firmware and robotics sit together because the constraints are the
  // same -- fixed memory, real deadlines, no easy redeploy -- even where the job
  // titles come from different industries.
  // ---------------------------------------------------------------------------
  {
    id: "embedded-systems-engineer",
    name: "Embedded Systems Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Embedded", "Firmware", "C", "Microcontroller", "Bare Metal", "MCU"],
    description:
      "Software on constrained hardware, where memory is fixed, timing is a requirement, and a field update is expensive.",
    popular: true,
  },
  {
    id: "embedded-software-engineer",
    name: "Embedded Software Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Embedded", "Firmware", "C", "C++", "Device Drivers", "Bare Metal"],
    description:
      "The software layer above the metal: drivers, board bring-up, and debugging with an oscilloscope in the loop.",
  },
  {
    id: "firmware-engineer",
    name: "Firmware Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Firmware", "Embedded", "C", "Bootloader", "Flash", "Microcontroller"],
    description:
      "Code that ships inside the device: boot sequence, peripheral registers, power states and safe over-the-air updates.",
  },
  {
    id: "hardware-engineer",
    name: "Hardware Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Hardware", "PCB", "Schematic", "Circuit Design", "Electronics"],
    description:
      "Designing the board itself -- schematics, PCB layout, component selection -- and validating it once it comes back from fab.",
  },
  {
    id: "electronics-engineer",
    name: "Electronics Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Electronics", "ECE", "Analog", "Signal Processing", "Circuit Design"],
    description:
      "Circuits and signals: analog and digital design, power, and the measurements that prove a design behaves.",
  },
  {
    id: "iot-engineer",
    name: "IoT Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["IoT", "Internet of Things", "MQTT", "Embedded", "Connected Devices", "Edge"],
    description:
      "Connected devices end to end: the constrained node, the protocol it speaks, and the fleet management behind it.",
  },
  {
    id: "iot-developer",
    name: "IoT Developer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["IoT", "Internet of Things", "MQTT", "Edge", "Sensors", "Device Cloud"],
    description:
      "The software around connected hardware: ingesting sensor data, provisioning devices, and the cloud side of a fleet.",
  },
  {
    id: "robotics-engineer",
    name: "Robotics Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Robotics", "ROS", "Control Systems", "Kinematics", "Automation"],
    description:
      "Machines that move: control loops, kinematics, sensing, and making a plan survive contact with the physical world.",
  },
  {
    id: "robotics-software-engineer",
    name: "Robotics Software Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Robotics", "ROS", "SLAM", "Motion Planning", "Perception", "C++"],
    description:
      "The software stack on a robot: perception, localisation and motion planning, usually in C++ on top of ROS.",
  },
  {
    id: "automotive-software-engineer",
    name: "Automotive Software Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Automotive", "AUTOSAR", "CAN", "ADAS", "ISO 26262", "Functional Safety"],
    description:
      "Vehicle software built to a safety standard, where the process and the traceability are as much the job as the code.",
  },
  {
    id: "automotive-embedded-engineer",
    name: "Automotive Embedded Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Automotive", "Embedded", "AUTOSAR", "CAN Bus", "ECU", "Firmware"],
    description:
      "Firmware on the ECUs themselves, talking over CAN or Ethernet inside a vehicle network someone else specified.",
  },
  {
    id: "rtos-engineer",
    name: "RTOS Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["RTOS", "Real Time Operating System", "FreeRTOS", "Zephyr", "Scheduling", "Embedded"],
    description:
      "Real-time scheduling as the core skill: task priorities, interrupt latency, and proving a deadline is always met.",
  },
  {
    id: "systems-engineer",
    name: "Systems Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["Systems", "Linux", "Systems Programming", "Kernel", "Low Level"],
    description:
      "The layer applications sit on: processes, memory, filesystems and the kernel interfaces everything else depends on.",
  },
  {
    id: "vlsi-engineer",
    name: "VLSI Engineer",
    categoryId: "software",
    subcategory: "Embedded & IoT",
    aliases: ["VLSI", "Verilog", "VHDL", "RTL Design", "Chip Design", "SystemVerilog", "FPGA"],
    description:
      "Digital design in RTL: writing Verilog, verifying it, and closing timing before anything reaches silicon.",
  },

  // ---------------------------------------------------------------------------
  // Game & Graphics
  //
  // Engine names are the search terms that matter -- people look for "Unity" and
  // "Unreal", rarely for "Game Programmer" -- and AR/VR/XR is one field with
  // three names, so all three roles cross-reference each other.
  // ---------------------------------------------------------------------------
  {
    id: "game-developer",
    name: "Game Developer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["Game Dev", "Gaming", "Unity", "Unreal", "Game Development"],
    description:
      "Building games: the loop, physics, input and the systems that make something feel good to play.",
    popular: true,
  },
  {
    id: "game-programmer",
    name: "Game Programmer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["Game Dev", "Gameplay Programmer", "C++", "Engine Programmer", "Gaming"],
    description:
      "The engineering side of a studio: gameplay and engine code in C++, held to a strict per-frame budget.",
  },
  {
    id: "graphics-programmer",
    name: "Graphics Programmer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["Graphics", "Rendering", "Shaders", "OpenGL", "Vulkan", "DirectX", "GPU"],
    description:
      "The render pipeline itself: shaders, lighting, and squeezing more out of the GPU without losing frames.",
  },
  {
    id: "unity-developer",
    name: "Unity Developer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["Unity", "Unity3D", "C#", "CSharp", "Game Dev", "Gaming"],
    description:
      "Unity projects in C#: the component model, prefabs, and profiling the scene when the frame rate drops.",
  },
  {
    id: "unreal-engine-developer",
    name: "Unreal Engine Developer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["Unreal", "Unreal Engine", "UE5", "UE4", "Blueprints", "C++", "Game Dev"],
    description:
      "Unreal work across Blueprints and C++, including the actor model and where the engine expects you to extend it.",
  },
  {
    id: "ar-vr-developer",
    name: "AR/VR Developer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: [
      "AR",
      "VR",
      "XR",
      "Metaverse",
      "Augmented Reality",
      "Virtual Reality",
      "Unity",
      "Headset",
    ],
    description:
      "Immersive applications for headsets and phones, where tracking, comfort and a hard frame-rate floor drive every decision.",
  },
  {
    id: "xr-developer",
    name: "XR Developer",
    categoryId: "software",
    subcategory: "Game & Graphics",
    aliases: ["XR", "AR", "VR", "Metaverse", "Extended Reality", "Mixed Reality", "OpenXR"],
    description:
      "The same field under its umbrella name: building against OpenXR so one experience runs across mixed-reality devices.",
  },

  // ---------------------------------------------------------------------------
  // Blockchain & Web3
  //
  // "Blockchain", "Web3" and "Crypto" are the same search intent expressed three
  // ways, so every role in this group carries all three plus the concrete tech.
  // ---------------------------------------------------------------------------
  {
    id: "blockchain-developer",
    name: "Blockchain Developer",
    categoryId: "software",
    subcategory: "Blockchain & Web3",
    aliases: ["Blockchain", "Web3", "Crypto", "Solidity", "Ethereum", "Smart Contracts"],
    description:
      "Building on chain: contracts, wallets and the application layer that has to work with a slow, public, immutable database.",
    popular: true,
  },
  {
    id: "blockchain-engineer",
    name: "Blockchain Engineer",
    categoryId: "software",
    subcategory: "Blockchain & Web3",
    aliases: ["Blockchain", "Web3", "Crypto", "Consensus", "Ethereum", "Protocol", "Cryptography"],
    description:
      "The protocol layer rather than the app: consensus, node infrastructure, and the cryptography underneath it.",
  },
  {
    id: "smart-contract-developer",
    name: "Smart Contract Developer",
    categoryId: "software",
    subcategory: "Blockchain & Web3",
    aliases: ["Smart Contracts", "Solidity", "Blockchain", "Web3", "Crypto", "Ethereum", "Audit"],
    description:
      "Contract code where every bug is a live exploit: reentrancy, gas costs, upgrade patterns and audit readiness.",
  },
  {
    id: "web3-developer",
    name: "Web3 Developer",
    categoryId: "software",
    subcategory: "Blockchain & Web3",
    aliases: ["Web3", "Blockchain", "Crypto", "Solidity", "dApp", "Ethers", "Wallet"],
    description:
      "The client side of decentralised apps: wallet connections, signing flows, and reading chain state into a normal UI.",
  },
  {
    id: "solidity-developer",
    name: "Solidity Developer",
    categoryId: "software",
    subcategory: "Blockchain & Web3",
    aliases: ["Solidity", "Smart Contracts", "Blockchain", "Web3", "Crypto", "EVM", "Hardhat"],
    description:
      "Solidity specifically: EVM behaviour, storage layout, and testing contracts with Hardhat or Foundry before deployment.",
  },

  // ---------------------------------------------------------------------------
  // Developer Relations
  //
  // Engineering-adjacent roles whose audience is other developers. Kept in
  // Software rather than Marketing because the interviews are technical.
  // ---------------------------------------------------------------------------
  {
    id: "technical-writer",
    name: "Technical Writer",
    categoryId: "software",
    subcategory: "Developer Relations",
    aliases: ["Tech Writer", "Documentation", "Docs", "Technical Documentation", "Content"],
    description:
      "Explaining a technical product in writing, which starts with understanding it well enough to find what the docs leave out.",
  },
  {
    id: "developer-advocate",
    name: "Developer Advocate",
    categoryId: "software",
    subcategory: "Developer Relations",
    aliases: ["DevRel", "Developer Relations", "Evangelist", "Community", "Advocacy"],
    description:
      "Representing the product to developers and the developers back to the product team, usually through demos, talks and samples.",
  },
  {
    id: "developer-relations-engineer",
    name: "Developer Relations Engineer",
    categoryId: "software",
    subcategory: "Developer Relations",
    aliases: ["DevRel", "Developer Relations", "Developer Experience", "DX", "Sample Apps"],
    description:
      "The engineering half of DevRel: reference implementations, SDK feedback, and fixing the friction developers report.",
  },
  {
    id: "open-source-developer",
    name: "Open Source Developer",
    categoryId: "software",
    subcategory: "Developer Relations",
    aliases: ["Open Source", "OSS", "Maintainer", "GitHub", "Contributor"],
    description:
      "Working in public: reviewing contributions, managing issues, and making compatibility decisions with an audience watching.",
  },
  {
    id: "technical-documentation-specialist",
    name: "Technical Documentation Specialist",
    categoryId: "software",
    subcategory: "Developer Relations",
    aliases: ["Documentation", "Docs", "Tech Writer", "API Documentation", "Docs as Code"],
    description:
      "Documentation as a system: information architecture, style consistency, and keeping reference material in step with releases.",
  },
];
