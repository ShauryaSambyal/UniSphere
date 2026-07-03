import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import CollegeDetails from './pages/CollegeDetails';
import Compare from './pages/Compare';
import Recommendations from './pages/Recommendations';
import Admin from './pages/Admin';
import Chatbot from './components/Chatbot';
import Chat from './pages/Chat';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Navbar />
        <main className="flex-grow pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/colleges/:id" element={<CollegeDetails />} />
            <Route path="/college/:id" element={<CollegeDetails />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </main>
        <Chatbot />
        <Footer />
      </div>
    </Router>
  );
}

export default App;
