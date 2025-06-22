require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gymdb', {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000
})
.then(() => {
  console.log('✅ MongoDB connected');
  startServer();
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});

// User Model
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    dbState: mongoose.connection.readyState 
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'Username exists' });
    }
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({
      message: 'User registered',
      token: jwt.sign({ userId: user._id, role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' })
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('🔗 Endpoints:');
    console.log(`   - GET  http://localhost:${PORT}/api/health`);
    console.log(`   - POST http://localhost:${PORT}/api/register`);
  });
}