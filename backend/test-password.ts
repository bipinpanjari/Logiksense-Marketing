import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function testPassword() {
  const prisma = new PrismaClient();
  const email = 'info@logiksense.ai';
  const password = 'Logiksense123!';

  try {
    const user = await prisma.customer.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found. Hash:', user.passwordHash);
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('Is password valid (using bcryptjs)?', isValid);

    // Also check if we should try a different library or just re-hash
    const newHash = await bcrypt.hash(password, 10);
    console.log('Newly generated hash for same password:', newHash);
    const isNewValid = await bcrypt.compare(password, newHash);
    console.log('Is newly generated valid?', isNewValid);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();
