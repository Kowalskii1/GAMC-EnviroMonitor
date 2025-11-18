import styled from "styled-components";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "https://qa.hermesoft.com/api";

export function Home() {
  const [stats, setStats] = useState({
    totalDispositivos: 0,
    totalMediciones: 0,
    promedioLAeq: 0,
    maxLAeq: 0,
  });
  const [serverStatus, setServerStatus] = useState({
    online: false,
    text: "Verificando sistema...",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHomeData();
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      if (response.ok && data.status === "OK") {
        setServerStatus({
          online: true,
          text: "Sistema Operativo",
        });
      } else {
        setServerStatus({
          online: false,
          text: "Sistema Degradado",
        });
      }
    } catch (error) {
      setServerStatus({ online: false, text: "Sistema Desconectado" });
    }
  };

  const loadHomeData = async () => {
    setLoading(true);
    try {
      const [resumenRes, devicesRes] = await Promise.all([
        fetch(`${API_BASE}/estadisticas/resumen`),
        fetch(`${API_BASE}/sensores/devices`),
      ]);

      const resumen = await resumenRes.json();
      const devices = await devicesRes.json();

      if (resumen.success && resumen.data) {
        setStats({
          totalDispositivos: devices.success ? devices.total || 0 : 0,
          totalMediciones: resumen.data.totalMediciones || 0,
          promedioLAeq: resumen.data.promedioLAeq || 0,
          maxLAeq: resumen.data.maxLAeq || 0,
        });
      }
    } catch (error) {
      console.error("Error cargando datos del home:", error);
    }
    setLoading(false);
  };

  const formatNumber = (value, decimals = 1) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0.0" : num.toFixed(decimals);
  };

  return (
    <Container>
      <Header>
        <HeaderContent>
          <h1>Dashboard Monitoreo Ambiental</h1>
          <Subtitle>
            Sistema de Monitoreo de Ruido Ambiental - LoRaWAN WS302
          </Subtitle>
        </HeaderContent>
        <StatusIndicator online={serverStatus.online}>
          <StatusDot online={serverStatus.online} />
          <span>{serverStatus.text}</span>
        </StatusIndicator>
      </Header>

      <WelcomeSection>
        <WelcomeCard>
          <h2>Bienvenido al Sistema de Monitoreo</h2>
          <p>
            Sistema integral para el monitoreo y análisis de sensores de ruido
            ambiental LoRaWAN WS302. Visualice datos en tiempo real, revise
            históricos y genere estadísticas avanzadas.
          </p>
        </WelcomeCard>
      </WelcomeSection>

      {loading ? (
        <LoadingBox>Cargando datos del sistema...</LoadingBox>
      ) : (
        <>
          <StatsSection>
            <SectionTitle>Estado General del Sistema</SectionTitle>
            <StatsGrid>
              <StatCard color="#2196F3">
                <StatIcon>📡</StatIcon>
                <StatValue>
                  {stats.totalMediciones.toLocaleString("es-CO")}
                </StatValue>
                <StatLabel>Mediciones Registradas</StatLabel>
              </StatCard>

              <StatCard color="#4CAF50">
                <StatIcon>📊</StatIcon>
                <StatValue>{stats.totalDispositivos}</StatValue>
                <StatLabel>Dispositivos Activos</StatLabel>
              </StatCard>

              <StatCard color="#FF9800">
                <StatIcon>📈</StatIcon>
                <StatValue>{formatNumber(stats.promedioLAeq)} dB</StatValue>
                <StatLabel>LAeq Promedio</StatLabel>
              </StatCard>

              <StatCard color="#FF5252">
                <StatIcon>⚡</StatIcon>
                <StatValue>{formatNumber(stats.maxLAeq)} dB</StatValue>
                <StatLabel>LAeq Máximo Registrado</StatLabel>
              </StatCard>
            </StatsGrid>
          </StatsSection>

          <FeaturesSection>
            <SectionTitle>Funcionalidades Principales</SectionTitle>
            <FeaturesGrid>
              <FeatureCard>
                <FeatureIcon>📈</FeatureIcon>
                <FeatureTitle>Dashboard Principal</FeatureTitle>
                <FeatureDescription>
                  Visualice el estado global de todos los sensores con gráficos
                  interactivos y métricas en tiempo real.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>🔍</FeatureIcon>
                <FeatureTitle>Dispositivos LoRaWAN</FeatureTitle>
                <FeatureDescription>
                  Analice el estado individual de cada sensor WS302: niveles de
                  ruido, batería y actividad reciente.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📋</FeatureIcon>
                <FeatureTitle>Datos en Tiempo Real</FeatureTitle>
                <FeatureDescription>
                  Acceda a las últimas mediciones registradas con información
                  detallada de LAeq, LAI, LAImax y estado de batería.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📊</FeatureIcon>
                <FeatureTitle>Análisis Avanzado</FeatureTitle>
                <FeatureDescription>
                  Genere reportes estadísticos profesionales con análisis
                  temporal, distribuciones, gráficos de control y pruebas de
                  normalidad.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📉</FeatureIcon>
                <FeatureTitle>Tendencias y Patrones</FeatureTitle>
                <FeatureDescription>
                  Identifique patrones temporales por hora del día, día de la
                  semana y tendencias a largo plazo.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>🎯</FeatureIcon>
                <FeatureTitle>Exportación de Datos</FeatureTitle>
                <FeatureDescription>
                  Exporte mediciones a formato CSV para análisis externos y
                  generación de reportes personalizados.
                </FeatureDescription>
              </FeatureCard>
            </FeaturesGrid>
          </FeaturesSection>

          <QuickAccessSection>
            <SectionTitle>Acceso Rápido</SectionTitle>
            <QuickAccessGrid>
              <QuickAccessButton as={Link} to="/dashboard">
                <ButtonIcon>🏠</ButtonIcon>
                <ButtonText>Dashboard Principal</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton as={Link} to="/dispositivos">
                <ButtonIcon>📡</ButtonIcon>
                <ButtonText>Dispositivos</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton as={Link} to="/datos">
                <ButtonIcon>📋</ButtonIcon>
                <ButtonText>Datos en Vivo</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton as={Link} to="/analytics">
                <ButtonIcon>📈</ButtonIcon>
                <ButtonText>Análisis Avanzado</ButtonText>
              </QuickAccessButton>
            </QuickAccessGrid>
          </QuickAccessSection>
        </>
      )}

      <Footer>
        <FooterText>
          Sistema de Monitoreo Ambiental WS302 © {new Date().getFullYear()} |
          Powered by LoRaWAN Technology
        </FooterText>
      </Footer>
    </Container>
  );
}

// STYLED COMPONENTS

const Container = styled.div`
  padding: 24px 32px;
  background: linear-gradient(135deg, #f5f9fc 0%, #e3f2fd 100%);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  flex-wrap: wrap;
  gap: 16px;
`;

const HeaderContent = styled.div`
  h1 {
    margin: 0 0 8px 0;
    font-size: 32px;
    color: #222;
    font-weight: 700;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 16px;
  color: #666;
  font-weight: 400;
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: ${(props) => (props.online ? "#e8f5e9" : "#ffebee")};
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => (props.online ? "#2e7d32" : "#c62828")};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
`;

const StatusDot = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(props) => (props.online ? "#4CAF50" : "#FF5252")};
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }
`;

const LoadingBox = styled.div`
  background: #e3f2fd;
  padding: 20px;
  color: #1976d2;
  border-radius: 8px;
  margin: 20px 0;
  font-weight: 500;
  text-align: center;
  font-size: 16px;
`;

const WelcomeSection = styled.div`
  margin-bottom: 32px;
`;

const WelcomeCard = styled.div`
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(33, 150, 243, 0.3);

  h2 {
    margin: 0 0 16px 0;
    font-size: 28px;
    font-weight: 700;
  }

  p {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    opacity: 0.95;
  }
`;

const StatsSection = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #222;
  font-weight: 700;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
`;

const StatCard = styled.div`
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  border-top: 4px solid ${(props) => props.color || "#2196F3"};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }
`;

const StatIcon = styled.div`
  font-size: 36px;
  margin-bottom: 12px;
`;

const StatValue = styled.div`
  font-size: 36px;
  font-weight: 700;
  color: #222;
  margin-bottom: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FeaturesSection = styled.div`
  margin-bottom: 32px;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
`;

const FeatureCard = styled.div`
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }
`;

const FeatureIcon = styled.div`
  font-size: 40px;
  margin-bottom: 16px;
`;

const FeatureTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #222;
  font-weight: 700;
`;

const FeatureDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
`;

const QuickAccessSection = styled.div`
  margin-bottom: 32px;
`;

const QuickAccessGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
`;

const QuickAccessButton = styled.div`
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  text-decoration: none;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(76, 175, 80, 0.4);
  }

  &:nth-child(2) {
    background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);

    &:hover {
      box-shadow: 0 8px 20px rgba(33, 150, 243, 0.4);
    }
  }

  &:nth-child(3) {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);

    &:hover {
      box-shadow: 0 8px 20px rgba(255, 152, 0, 0.4);
    }
  }

  &:nth-child(4) {
    background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3);

    &:hover {
      box-shadow: 0 8px 20px rgba(156, 39, 176, 0.4);
    }
  }
`;

const ButtonIcon = styled.div`
  font-size: 32px;
`;

const ButtonText = styled.div`
  font-size: 16px;
  font-weight: 600;
`;

const Footer = styled.div`
  margin-top: 48px;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
`;

const FooterText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #666;
`;
