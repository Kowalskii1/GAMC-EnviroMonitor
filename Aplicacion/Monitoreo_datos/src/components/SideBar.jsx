import styled from "styled-components";
import logo from "../assets/logo.png";
import {Container,Divider} from "../components/SideBarStyles";
import {
  AiOutlineLeft,
  AiOutlineHome,
  AiOutlineApartment,
  AiOutlineSetting,
  AiOutlineBarChart,
  AiOutlineMonitor,
} from "react-icons/ai";
import { MdOutlineAnalytics, MdLogout } from "react-icons/md";
import { NavLink } from "react-router-dom";
import { useContext } from "react";
import { ThemeContext } from "../App";
export function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const ModSidebaropen = () => {
    setSidebarOpen(!sidebarOpen);
  };
  const { setTheme, theme } = useContext(ThemeContext);
  const CambiarTheme = () => {
    setTheme((theme) => (theme === "light" ? "dark" : "light"));
  };

  return (
    <Container isOpen={sidebarOpen} themeUse={theme}>
      <button className="Sidebarbutton" onClick={ModSidebaropen}>
        <AiOutlineLeft />
      </button>
      <div className="Logocontent">
        <div className="imgcontent">
          <img src={logo} />
        </div>
        <h2>Monitoreo de datos</h2>
      </div>
      {linksArray.map(({ icon, label, to }) => (
        <div className="LinkContainer" key={label}>
          <NavLink
            to={to}
            className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
          >
            <div className="Linkicon">{icon}</div>
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        </div>
      ))}
      <Divider />
      {secondarylinksArray.map(({ icon, label, to }) => (
        <div className="LinkContainer" key={label}>
          <NavLink
            to={to}
            className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
          >
            <div className="Linkicon">{icon}</div>
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        </div>
      ))}
    </Container>
  );
}
// lista
const linksArray = [
  {
    label: "Home",
    icon: <AiOutlineHome />,
    to: "/",
  },
  {
    label: "Datos Calidad de Aire",
    icon: <AiOutlineBarChart/>,
    to: "/datos_calidad_aire",
  },
  {
    label: "Datos Sonido",
    icon: <AiOutlineBarChart/>,
    to: "/datos_sonido",
  },
  {
    label: "Datos Soterrados",
    icon: <AiOutlineBarChart/>,
    to: "/datos_soterrados",
  },
  {
    label: "Reportes",
    icon: <MdOutlineAnalytics />,
    to: "/reportes",
  },
];
const secondarylinksArray = [
  {
    label: "Configuración",
    icon: <AiOutlineSetting />,
    to: "/null",
  },
  {
    label: "Salir",
    icon: <MdLogout />,
    to: "/null",
  },
];

