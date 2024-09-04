import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google-cloud/storage';

import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';
import { allOrders } from '../orders/fetch.orders';

// Create a new Google Cloud Storage client
const storage = new Storage();
const bucketName = 'connector-bck'; // Replace with your public bucket name
const bucket = storage.bucket(bucketName);

export const post = async (_request: Request, response: Response) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const fileName = `orders_${today}.csv`;
    const filePath = path.join(__dirname, `../../csv/${fileName}`);

    // Get the orders for today
    const orders = await allOrders({ where: `createdAt >= "${today}T00:00:00Z" and createdAt <= "${today}T23:59:59Z"` });

    // Extract order IDs and write to a CSV
    const orderIds = orders.results.map(order => order.id);
    writeOrdersToLocalCSV(filePath, orderIds);

    // Upload CSV to GCS
    await uploadCSVToGCS(filePath, fileName);

    logger.info(`Orders for ${today} have been written to ${fileName} in GCS bucket ${bucketName}`);
    response.status(200).send(`Orders for ${today} have been written to ${fileName} in GCS bucket ${bucketName}`);
  } catch (error) {
    throw new CustomError(
      500,
      `Internal Server Error - Error retrieving all orders from the commercetools SDK`
    );
  }
};

const writeOrdersToLocalCSV = (filePath: string, orderIds: string[]) => {
  const csvContent = 'OrderID\n' + orderIds.join('\n');
  fs.writeFileSync(filePath, csvContent, { encoding: 'utf8' });
};

const uploadCSVToGCS = async (filePath: string, destFileName: string) => {
  await bucket.upload(filePath, {
    destination: destFileName,
    gzip: true, // Optional: Compress the file during upload
  });
};