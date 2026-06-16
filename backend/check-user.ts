import { PrismaClient } from '@prisma/client';

async function checkUser() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.customer.findUnique({
      where: { email: 'info@logiksense.ai' }
    });
    
    if (user) {
      console.log('User found:');
      console.log(JSON.stringify(user, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    } else {
      console.log('User not found.');
    }
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
