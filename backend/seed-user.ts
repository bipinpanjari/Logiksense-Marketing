import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const prisma = new PrismaClient();
  const email = 'info@logiksense.ai';
  const password = 'Logiksense123!';
  const firstName = 'Logiksense';
  const lastName = 'Admin';

  try {
    console.log(`Checking if user ${email} exists...`);
    const existingUser = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('User already exists. Updating password...');
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.customer.update({
        where: { id: existingUser.id },
        data: { passwordHash }
      });
      console.log('✓ Password updated');
      return;
    }

    console.log('Creating user...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.customer.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          onboardingCompleted: true,
          planTier: 'starter',
          subscriptionStatus: 'active',
          role: 'owner',
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          customerId: user.id,
          name: "Logiksense Workspace",
          isActive: true,
        }
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          customerId: user.id,
          role: 'owner',
        }
      });

      return { user, workspace };
    });

    console.log('✓ User and Workspace created successfully!');
    console.log('Email:', result.user.email);
    console.log('Workspace:', result.workspace.name);

  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
