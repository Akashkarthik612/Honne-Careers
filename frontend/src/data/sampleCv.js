// Sample data from the design canvas, shown until the profile and tailoring APIs exist.

export const SAMPLE_CV = {
  name: 'Arjun Mehta',
  contact: ['Chennai, India', '+91 98xxx xxxxx', 'arjun.mehta@mail.com', 'linkedin.com/in/arjunmehta', 'github.com/arjunm'],
  experience: [
    {
      role: 'Software Engineer', dates: 'Jul 2021 – Present', company: 'Northwind Fintech', location: 'Bengaluru, India',
      bullets: [
        'Cut payment-event latency by 38% (p95) by moving the ledger service to Kafka Streams in Java on AWS',
        'Owned the settlement pipeline end to end, scaling it to 2M events/day with zero data loss through idempotent consumers and replay tooling',
        'Mentored 2 interns to their first production launch, both shipping in under 8 weeks',
      ],
    },
    {
      role: 'Associate Software Engineer', dates: 'Aug 2020 – Jun 2021', company: 'Brightline Systems', location: 'Chennai, India',
      bullets: [
        'Reduced on-call pages by 30% by adding alerting and runbooks across 6 Java services',
        'Wrote SQL migrations for a 40M-row orders table with no downtime',
      ],
    },
  ],
  projects: [
    { name: 'Ledger-lite', tech: 'Java, Spring Boot, PostgreSQL, Docker', year: '2023', bullets: ['Built a double-entry ledger that sustained 1,000 TPS in load tests, measured with k6'] },
  ],
  education: [
    { school: 'Anna University', location: 'Chennai, India', degree: 'B.E. in Computer Science and Engineering', years: '2016 – 2020' },
  ],
  skills: [
    ['Languages', 'Java, Python, SQL'],
    ['Frameworks', 'Spring Boot, Kafka Streams, JUnit'],
    ['Cloud & tools', 'AWS (EC2, SQS, RDS), Docker, Git, Grafana'],
  ],
};

export const SAMPLE_JD = `SDE-2, Backend · Chennai

About the role
You’ll build the high-scale services behind our customer platform, and own them in production.

What you’ll do
• Design and own event-driven services in Java and Kafka on AWS
• Improve the reliability and latency of systems handling millions of events a day
• Mentor junior engineers and review code

What we’re looking for
• 3+ years of backend experience
• Strong Java, distributed systems and SQL
• Experience with Kubernetes is a plus`;

export const SAMPLE_PROFILE_FILE = 'CV_Arjun_2026.pdf';
