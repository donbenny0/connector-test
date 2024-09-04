import { Request, Response } from 'express';
import { format } from 'date-fns';
import fs from 'fs';
import CustomError from '../errors/custom.error';
import { logger } from '../utils/logger.utils';
import { allOrders } from '../orders/fetch.orders';
import { Parser } from 'json2csv';
/**
 * Exposed job endpoint.
 *
 * @param {Request} _request The express request
 * @param {Response} response The express response
 * @returns
 */
export const post = async (_request: Request, response: Response) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch orders that occurred today
    const limitedOrdersObject = await allOrders({
      // where: `lastModifiedAt >= "${today}T00:00:00.000Z" and lastModifiedAt <= "${today}T23:59:59.999Z"`,
      sort: ['lastModifiedAt desc'],
    });



    const orders = limitedOrdersObject.results;
    logger.info(`There are ${orders.length} orders from today!`);

    // Extract order IDs
    const orderIds = orders.map((order) => ({
      orderId: order.id,
    }));

    // Convert to CSV using json2csv
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(orderIds);

    // Define the file name as today's date
    const fileName = `${today}.csv`;

    // Save the CSV file
    fs.writeFileSync(fileName, csv);
    logger.info(`Order IDs have been saved to ${fileName}`);

    response.status(200).send(`Order IDs have been saved to ${fileName}`);
  } catch (error) {
    logger.error('Error while fetching and saving orders', error);
    throw new CustomError(
      500,
      `Internal Server Error - Error retrieving and saving today's orders from the commercetools SDK`
    );
  }
};
