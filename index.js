// npm run devStart - to run the auto regen 
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

const corsOptions = {
  origin: 'http://localhost:3000',
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'store_online',
});

app.get('/api', (req, res) => {
  res.send('You made the response from the TopShopData server')
})

app.get('/api/items', (req, res) => {
  pool.query('SELECT * FROM items', (error, results) => {
    if (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(results);
    }
  });
});

app.post('/api/order', (req, res) => {
  const { orderItems, customerData, order } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    connection.query('SELECT customer_ID FROM customers WHERE email = ?', [customerData.email], (error, results) => {
      if (error) {
        connection.release();
        console.error('Error querying the database:', error);
        res.status(500).send('Internal Server Error');
        return;
      }

      if (results.length > 0) {
        const customerID = results[0].customer_ID;
        insertOrderAndCustomer(connection, customerID, order);
      } else {
        connection.query('INSERT INTO customers (first_name, last_name, phone_1, phone_2, email, city, street, street_number, apartment, lon, lat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [customerData.first_name, customerData.last_name, customerData.phone_1, customerData.phone_2, customerData.email, customerData.city, customerData.street, customerData.street_number, customerData.apartment, customerData.lon, customerData.lat],
        (insertError, insertResults) => {
            if (insertError) {
              connection.release();
              console.error('Error inserting new customer:', insertError);
              res.status(500).send('Internal Server Error');
              return;
            }
            const customerID = insertResults.insertId;
            insertOrderAndCustomer(connection, customerID, order);
          }
        );
      }
    });
  });

  function insertOrderAndCustomer(connection, customerID, order) {
    connection.query('INSERT INTO orders (number, entry_date, delivery_date, status, placement_date) VALUES (?, ?, ?, ?, ?)',
      [order.number, order.entry_date, order.delivery_date, order.status, order.placement_date],
      (insertError, insertResults) => {
        if (insertError) {
          connection.release();
          console.error('Error inserting the order:', insertError);
          res.status(500).send('Internal Server Error');
          return;
        }

        const orderID = insertResults.insertId;

        connection.query('INSERT INTO customer_orders (customer_ID, order_ID) VALUES (?, ?)',
          [customerID, orderID],
          (insertCustomerOrderError) => {
            connection.release();
            if (insertCustomerOrderError) {
              console.error('Error inserting into customer_orders:', insertCustomerOrderError);
              res.status(500).send('Internal Server Error');
              return;
            }

            const orderItemValues = orderItems.map((item) => [orderID, item.item_ID, item.quantity]);
            connection.query('INSERT INTO order_items (order_ID, item_ID, quantity) VALUES ?',
              [orderItemValues],
              (insertOrderItemsError) => {
                if (insertOrderItemsError) {
                  console.error('Error inserting order items:', insertOrderItemsError);
                  res.status(500).send('Internal Server Error');
                  return;
                }

                res.status(200).send('Order created successfully');
              }
            );
          }
        );
      }
    );
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
