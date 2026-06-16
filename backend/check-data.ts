
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const customerCount = await prisma.customer.count();
    const workspaceCount = await prisma.workspace.count();
    const emailSequenceCount = await prisma.emailSequence.count();
    const linkedinSequenceCount = await prisma.linkedInSequence.count();

    console.log('--- DATABASE STATS ---');
    console.log(`Customers: ${customerCount}`);
    console.log(`Workspaces: ${workspaceCount}`);
    console.log(`Email Sequences: ${emailSequenceCount}`);
    console.log(`LinkedIn Sequences: ${linkedinSequenceCount}`);

    console.log('\n--- CUSTOMERS ---');
    const customers = await prisma.customer.findMany({ select: { id: true, email: true } });
    customers.forEach(c => console.log(`- ${c.email} (${c.id})`));

    console.log('\n--- WORKSPACES ---');
    const workspaces = await prisma.workspace.findMany({ select: { id: true, name: true, customerId: true } });
    workspaces.forEach(w => console.log(`- ${w.name} (ID: ${w.id}, Owner: ${w.customerId})`));

    if (emailSequenceCount > 0) {
      console.log('\n--- EMAIL SEQUENCES ---');
      const sequences = await prisma.emailSequence.findMany({ 
        take: 10,
        select: { id: true, name: true, createdAt: true }
      });
      sequences.forEach(s => console.log(`- ${s.name} (Created: ${s.createdAt})`));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
