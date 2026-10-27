// Illustrative content for the template picker's thumbnail only (design canvas: "Arjun Mehta").
// It is never a user's data and never sent to the API.

export const PREVIEW_PROFILE = {
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
  spoken: [{ id: 'l1', name: 'English', level: 'professional' }, { id: 'l2', name: 'Tamil', level: 'native' }],
  certs: [{ id: 'c1', name: 'AWS Certified Developer', issuer: 'Amazon Web Services', date: '2023' }],
};
