const { analyzeJobMatch } = require('./dist/index.js');

const jd = `
We are looking for a Senior AI/ML Engineer.
Key Requirements:
- Deep learning, neural networks, and computer vision models.
- Artificial intelligence solutions with PyTorch or TensorFlow.
- Experience with Palantir Foundry, cloud architecture on AWS or Azure.
- Microservices, Docker, Kubernetes, CI/CD pipelines.
- A 15 years full time education is required.
`;

const resume = `
Experienced Machine Learning Engineer with 6 years building deep learning and neural networks models.
Proficient in Python, PyTorch, computer vision, AWS, and Docker containerization.
Designed microservices architecture and automated CI/CD deployments.
`;

const res = analyzeJobMatch({ resumeText: resume, jobDescription: jd });
console.log("Matched:", res.matched);
console.log("Missing:", res.missing);
console.log("Score:", res.score);
