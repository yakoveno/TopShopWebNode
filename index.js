const mysql = require('mysql2/promise');

const pool = mysql.createPool({



    database: 'store_online',
    port: '3306',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
});

exports.handler = async (event) => {
    try {
        const httpMethod = event.httpMethod;
        const resource = event.resource;

        if (httpMethod === 'GET' && resource === '/items') {
            const query = 'SELECT * FROM items';
            const [items] = await pool.execute(query);
            const response = {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: JSON.stringify({ items }),
            };
            return response;
        } else if (httpMethod === 'POST' && resource === '/order') {
            try {
                const { orderItems, customerData, order } = JSON.parse(event.body);

                const customerID = await getOrCreateCustomer(pool, customerData);

                const orderID = await insertOrder(pool, order);

                await insertCustomerOrder(pool, customerID, orderID);

                await insertOrderItems(pool, orderItems, orderID);

                const successResponse = {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Credentials': true,
                    },
                        body: JSON.stringify({ 
                        message: `הזמנה שודרה: ${orderID} ללקוח: ${customerID}`,
                        orderID,
                        customerID,
                    }),
                };

                return successResponse;
            } catch (error) {
                console.error('Error parsing JSON or processing order:', error);
                const errorResponse = {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid request payload or order processing error' }),
                };
                return errorResponse;
            }
        } else {
            const errorResponse = {
                statusCode: 404,
                body: JSON.stringify({ error: 'Resource not found' }),
            };
            return errorResponse;
        }
    } catch (error) {
        console.error('Error:', error);
        const errorResponse = {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
        return errorResponse;
    }
};

async function getOrCreateCustomer(pool, customerData) {
    const [results] = await pool.execute('SELECT customer_ID FROM customers WHERE email = ?', [customerData.email]);

    if (results.length > 0) {
        return results[0].customer_ID;
    } else {
        const [insertResults] = await pool.execute('INSERT INTO customers (first_name, last_name, phone_1, phone_2, email, city, street, street_number, apartment, lon, lat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [customerData.first_name, customerData.last_name, customerData.phone_1, customerData.phone_2, customerData.email, customerData.city, customerData.street, customerData.street_number, customerData.apartment, customerData.lon, customerData.lat]
        );

        return insertResults.insertId;
    }
}

async function insertOrder(pool, order) {
    const [insertResults] = await pool.execute('INSERT INTO orders (number, entry_date, delivery_date, status, placement_date) VALUES (?, ?, ?, ?, ?)',
        [order.number, order.entry_date, order.delivery_date, order.status, order.placement_date]
    );

    return insertResults.insertId;
}

async function insertCustomerOrder(pool, customerID, orderID) {
    await pool.execute('INSERT INTO customer_orders (customer_ID, order_ID) VALUES (?, ?)',
        [customerID, orderID]
    );
}

async function insertOrderItems(pool, orderItems, orderID) {
    try {
        for (const item of orderItems) {
            const orderItemValues = [orderID, item.item_ID, item.quantity];
            await pool.execute('INSERT INTO order_items (order_ID, item_ID, quantity) VALUES (?, ?, ?)', orderItemValues);
        }
    } catch (error) {
        console.error('Error inserting order items:', error);
        throw error;
    }
}

