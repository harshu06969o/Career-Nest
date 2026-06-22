const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.studentProfile.updateMany({
    where: { college: 'MIT' },
    data: { parsedSkills: ['react', 'node.js', 'typescript', 'mongodb', 'docker'], resumeUrl: 'https://example.com/resume.pdf' }
  });
  console.log('Profile seeded');
}
run();
