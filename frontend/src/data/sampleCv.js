// Sample data from the design canvas, shown until the profile, tailoring and resume APIs exist.

// The profile as the user wrote it: rough notes are fine (PROF-6). Tailored CVs rewrite these, never add to them (TRUTH-4).
export const SAMPLE_PROFILE = {
  personal: {
    name: 'Arjun Mehta', city: 'Chennai, India', email: 'arjun.mehta@mail.com', phone: '+91 98xxx xxxxx',
    linkedin: 'linkedin.com/in/arjunmehta', github: 'github.com/arjunm',
  },
  roles: [
    {
      id: 'r1', role: 'Software Engineer', company: 'Northwind Fintech', start: 'Jul 2021', end: 'Present', location: 'Bengaluru, India',
      bullets: [
        { id: 'b1', text: 'Moved the ledger service to Kafka Streams in Java on AWS; p95 latency went down about 38%.' },
        { id: 'b2', text: 'Owned the settlement pipeline — 2M events/day, no data loss. Added idempotent consumers and replay tooling.' },
        { id: 'b3', text: 'Mentored 2 interns to their first production launch, both shipping in under 8 weeks' },
      ],
    },
    {
      id: 'r2', role: 'Associate Software Engineer', company: 'Brightline Systems', start: 'Aug 2020', end: 'Jun 2021', location: 'Chennai, India',
      bullets: [
        { id: 'b4', text: 'Reduced on-call pages by 30% by adding alerting and runbooks across 6 Java services' },
        { id: 'b5', text: 'Wrote SQL migrations for a 40M-row orders table with no downtime' },
      ],
    },
  ],
  projects: [
    { id: 'p1', name: 'Ledger-lite', tech: 'Java, Spring Boot, PostgreSQL', year: '2023', bullets: [{ id: 'pb1', text: 'Double-entry ledger. 1,000 TPS in k6 load tests.' }] },
  ],
  education: [
    { id: 'e1', school: 'Anna University', degree: 'B.E. Computer Science and Engineering', years: '2016 – 2020', city: 'Chennai, India' },
  ],
  skills: {
    lang: ['Java', 'Python', 'SQL'],
    fw: ['Spring Boot', 'Kafka Streams', 'JUnit'],
    tools: ['AWS (EC2, SQS, RDS)', 'Git', 'Grafana'],
  },
};

// What the tailoring mock returns per bullet id ("Accomplished X, measured by Y, by doing Z", TAIL-4).
// Bullets without an entry come back unchanged.
export const SAMPLE_TAILORED = {
  b1: 'Cut payment-event latency by 38% (p95) by moving the ledger service to Kafka Streams in Java on AWS',
  b2: 'Owned the settlement pipeline end to end, scaling it to 2M events/day with zero data loss through idempotent consumers and replay tooling',
  b3: 'Mentored 2 interns through their first production launch; both shipped in under 8 weeks',
  pb1: 'Built a double-entry ledger in Java and PostgreSQL that sustained 1,000 TPS in k6 load tests',
};

export const SAMPLE_JD = `SDE-2, Backend · Freshworks · Chennai

About the role
You’ll build the high-scale services behind our customer platform, and own them in production.

What you’ll do
• Design and own event-driven services in Java and Kafka on AWS
• Improve the reliability and latency of systems handling millions of events a day
• Mentor junior engineers and review code

What we’re looking for
• 3+ years of backend experience
• Strong Java, distributed systems and SQL
• Experience with Kubernetes and Docker is a plus`;

// Skills the JD names; the wizard suggests the ones missing from the profile (TAIL-6: suggested, never auto-added).
export const SAMPLE_JD_SKILLS = ['Java', 'Kafka', 'AWS', 'SQL', 'Kubernetes', 'Docker'];

export const SAMPLE_PROFILE_FILE = 'CV_Arjun_2026.pdf';
