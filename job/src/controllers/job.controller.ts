import { Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';
import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';
import { allOrders } from '../orders/fetch.orders';
import { Readable } from 'stream';

// Create a new Google Cloud Storage client
const storage = new Storage();
const bucketName = 'connector-bck'; // Replace with your public bucket name
const bucket = storage.bucket(bucketName);

export const post = async (_request: Request, response: Response) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const fileName = `orders_${today}.csv`;

    // Get the orders for today
    const orders = await allOrders({
      where: `createdAt >= "${today}T00:00:00Z" and createdAt <= "${today}T23:59:59Z"`
    });

    // Extract order IDs
    const orderIds = orders.results.map(order => order.id);

    // Create CSV content
    const csvContent = 'OrderID\n' + orderIds.join('\n');

    // Upload CSV to GCS
    await uploadCSVToGCS(csvContent, fileName);

    logger.info(`Orders for ${today} have been written to ${fileName} in GCS bucket ${bucketName}`);
    response.status(200).send(`Orders for ${today} have been written to ${fileName} in GCS bucket ${bucketName}`);
  } catch (error) {
    logger.error('Error while fetching and uploading orders', error);
    throw new CustomError(
      500,
      `Internal Server Error - Error retrieving and uploading orders to GCS`
    );
  }
};

const uploadCSVToGCS = async (csvContent: string, destFileName: string) => {
  const file = bucket.file(destFileName);
  const stream = new Readable();
  stream.push(csvContent);
  stream.push(null);

  return new Promise((resolve, reject) => {
    stream
      .pipe(file.createWriteStream({
        gzip: true, // Compress the file during upload
        metadata: {
          contentType: 'text/csv',
        },
      }))
      .on('error', reject)
      .on('finish', resolve);
  });
};