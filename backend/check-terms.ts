import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.customer.findUnique({
    where: { email: 'info@logiksense.ai' }
  });
  console.log('RESULTS:');
  console.log('Terms Accepted:', user?.termsAccepted);
  console.log('Accepted At:', user?.termsAcceptedAt);
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
