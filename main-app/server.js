const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');

const connectionString = 'postgressql://postgres:060669@localhost:5432/online_store';
const { Client } = require('pg');

const client = new Client({
    connectionString
})
client.connect();

//helper function
getNewDate = () => {
    const date_ob = new Date();
    const date = ("0" + date_ob.getDate()).slice(-2);
    const month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    const year = date_ob.getFullYear();
    return year + "-" + month + "-" + date;
}
var cartid;

const app = express();

app.set('views', './views');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
})
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
})
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
})
app.get('/logintocontinue', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logintocontinue.html'));
})
app.get('/logout', (req, res) => {
    req.session.loggedin = false;
    res.redirect('/');
})
//To display clothing table
app.get('/collection', (req, res) => {
    client
    .query('SELECT * FROM CLOTHING',
    (err, result) => {
        if(err) {
            console.log(err);
            res.sendStatus(500);
            return;
        }
        if(result.rows.length > 0) {
            if(req.session.loggedin === true) 
                res.render('collection_user.ejs', {result: result});
            else    
                res.render('collection_guest.ejs', {result: result});
        }
            

    })
})

//user cart
app.get('/usercart', (req, res) => { 
    if(req.session.loggedin !== true)
        res.redirect('/logintocontinue');
    else  { //  QUERY ERROR - FIX!
        // var qry =   "SELECT clothing_name, category, description, seller, price, quantity \
        // FROM Clothing, Cart_item \
        // WHERE Clothing.clothing_id IN(SELECT clothing_id FROM cart_item WHERE cart_id = \
        // (SELECT cart_id FROM Cart WHERE if_bought = FALSE AND username = $1))";
        client  
            .query(qry,
            [req.session.username],
            (err, result) => {
                if(err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                res.render('usercart.ejs', {result: result, res: req.session.username}) 
            })
    }
})
//Welcome page
app.get('/welcome', (req, res) => {
    if(req.session.loggedin === true) 
        res.render('welcome.ejs', {result: req.session.username});  
    else
        res.redirect('/logintocontinue');
});

app.post('/addtocart', (req, res) => {
    if(req.session.loggedin !== true) {
        res.redirect('/logintocontinue');
        res.end();
    } else {
        const clothing_id = req.body.clothing_id;
        let clothing_price = 0;
        client //returning open carts for the user
            .query('SELECT cart_id FROM Cart WHERE if_bought = FALSE AND username = $1',
            [req.session.username],
            (err, result) => {
                if(err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                if(result.rows.length === 0) { //no open cart for the user
                    const d = getNewDate();
                    client
                        .query('INSERT INTO Cart(username, order_date) VALUES($1, $2)',
                        [req.session.username, d],
                        (err, result) => {
                            if(err) {
                                console.log(err);
                                res.sendStatus(500);
                                return;
                            } else console.log('Created new cart');
                        });
                }
            })
        client  
            .query('SELECT price FROM Clothing WHERE clothing_id = $1', 
            [clothing_id], 
            (err, result) => {
                if(err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                clothing_price = result.rows[0]['price']; 
                
            });
        client
            .query('SELECT cart_id FROM Cart WHERE if_bought = FALSE AND username = $1',
            [req.session.username],
            (err, result) => {
                if(err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                } 
                cartid = result.rows[0]['cart_id'];
                client
                    .query('SELECT quantity FROM Cart_item WHERE cart_id = $1 AND clothing_id = $2',
                    [cartid, clothing_id],
                    (err, result) => { 
                        if(err) { 
                            console.log(err);
                            res.sendStatus(500);
                            return;
                        } 
                    
                        if(result.rows.length !== 0) { //product  already added to cart by customer
                            client
                                .query('UPDATE Cart_item SET quantity = quantity+1, clothing_cost = clothing_cost + $1 WHERE cart_id = $2 AND clothing_id = $3',
                                [clothing_price, cartid, clothing_id],
                                (err, result) => {
                                    if(err) {
                                        console.log(err);
                                        res.sendStatus(500);
                                        return;
                                    } 
                                }) ;                   
                        } else { // need to insert the product into the cart_item table
                            client
                                .query('INSERT INTO Cart_item(cart_id, clothing_id, clothing_cost, quantity) VALUES($1, $2, $3, $4)',
                                [cartid, clothing_id, clothing_price, 1],
                                (err, result) => {
                                    if(err) {
                                        console.log(err);
                                        res.sendStatus(500);
                                        return;
                                    }
                                    
                                });
                        }
                        res.redirect('/usercart');
                    });
                
            });
    }    
})
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if(username && password) {
        client
            .query('SELECT * FROM Customer WHERE username = $1 AND pass = $2', [username, password],
            (err, result) => {
                if(err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                }
                if(result.rows.length !== 0){
                    req.session.loggedin = true;
                    req.session.username = username;
                    res.redirect('/welcome');
                } else {
                    res.send("<script>alert('Invalid username and/or password')</script>");
                }

            });
    } else {
        res.send('Invalid');
    }
})

app.post('/signup', (req, res) => {
    const {
        firstname,
        lastname,
        dob,
        phno,
        address,
        gender,
        email,
        username,
        password
    } = req.body;
    
    client
        .query('SELECT * FROM Customer WHERE email = $1', [email],
        (err, result) => {
            if(result.rows.length !== 0)
            {
                res.status(400).send("<script>alert('Email already exists, try again')</script>");
                return;
            } 
            res.end();   
        })

    client
        .query('SELECT * FROM Customer WHERE username = $1', [username],
        (err, result) => {
            if(result.rows.length !== 0)
            {
                res.status(400).send("<script>alert('Username already exists')</script>");
                return;
            }  
            res.end();
        })

    client
        .query('INSERT INTO Customer VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [username, password, firstname, lastname, dob, gender, phno, email, address],
        (err, result) => {
            if(err) {
                console.log(err);
                res.sendStatus(500);
                return;
            } 
            res.status(201).send("<script>alert('Customer Created !')</script>");
        })
})



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`App is running on port ${PORT}`);
})