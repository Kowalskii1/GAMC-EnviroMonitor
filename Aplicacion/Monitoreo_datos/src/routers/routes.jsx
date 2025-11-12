import {BrowserRouter,Routes,Route} from "react-router-dom"
import { Home } from "../pages/Home";
import { DashboardCalidadAire } from "../pages/DatosCalidadAire";
import { DashboardSonido} from "../pages/DatosSonido";
import { DashboardSoterrados } from "../pages/DatosSoterrados";
 
export function MyRoutes(){
    return (
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/datos_calidad_aire" element={<DashboardCalidadAire/>}/>
        <Route path="/datos_sonido" element={<DashboardSonido/>}/>
        <Route path="/datos_soterrados" element={<DashboardSoterrados/>}/>
      </Routes>
    );
}