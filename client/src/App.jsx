import { useState } from 'react'
import Login from './pages/login'
function App() {
  const [count, setCount] = useState(0)
  const [currPage , setCurrPage] = useState(null);

  return (
    <>
      <Login />
    </>
  )
}

export default App
