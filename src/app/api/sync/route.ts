import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Use a global prisma client to avoid exhausting connection limits in serverless
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Sync: Received payload");
    const { categories, products, transactions } = body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Sync Categories
      if (categories && Array.isArray(categories)) {
        for (const cat of categories) {
          await tx.category.upsert({
            where: { id: cat.id },
            update: {
              name: cat.name,
              description: cat.description,
              deletedAt: cat.deletedAt ? new Date(cat.deletedAt) : null,
            },
            create: {
              id: cat.id,
              name: cat.name,
              description: cat.description,
              createdAt: new Date(cat.createdAt),
              updatedAt: new Date(cat.updatedAt),
            },
          });
        }
      }

      // 2. Sync Products
      if (products && Array.isArray(products)) {
        for (const prod of products) {
          await tx.product.upsert({
            where: { id: prod.id },
            update: {
              name: prod.name,
              barcode: prod.barcode,
              price: prod.price,
              stock: prod.stock,
              categoryId: prod.categoryId,
              imagePath: prod.imagePath,
              deletedAt: prod.deletedAt ? new Date(prod.deletedAt) : null,
            },
            create: {
              id: prod.id,
              name: prod.name,
              barcode: prod.barcode,
              price: prod.price,
              stock: prod.stock,
              categoryId: prod.categoryId,
              imagePath: prod.imagePath,
              createdAt: new Date(prod.createdAt),
              updatedAt: new Date(prod.updatedAt),
            },
          });
        }
      }

      // 3. Sync Transactions
      if (transactions && Array.isArray(transactions)) {
        for (const txData of transactions) {
          const existingTx = await tx.transaction.findUnique({
            where: { id: txData.header.id },
          });

          if (!existingTx) {
            await tx.transaction.create({
              data: {
                id: txData.header.id,
                totalAmount: txData.header.totalAmount,
                paymentMethod: txData.header.paymentMethod,
                createdAt: new Date(txData.header.createdAt),
                items: {
                  create: txData.items.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    createdAt: new Date(item.createdAt),
                  })),
                },
              },
            });
          }
        }
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Sync Fatal Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'Sync API is active', database: 'connected' });
  } catch (e: any) {
    return NextResponse.json({ status: 'Sync API is active', database: 'error', message: e.message }, { status: 500 });
  }
}
