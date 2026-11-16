import React from 'react'
import {createRoot} from 'react-dom/client'
import Workbench from './Workbench'
import './layout.css'
import WindowFrame from './WindowFrame'
createRoot(document.getElementById('root')!).render(<React.StrictMode><WindowFrame><Workbench/></WindowFrame></React.StrictMode>)
