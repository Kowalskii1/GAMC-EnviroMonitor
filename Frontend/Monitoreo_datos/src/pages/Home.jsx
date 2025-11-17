import styled from "styled-components";
import React, { useEffect, useState } from "react";

const API = "https://qa.hermesoft.com/api";

export function Home() {
  const [stats, setStats] = useState({
    totalSensores: 0,
    totalAlertas: 0,
    operativos: 0,
    promedioData: 0,
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
      const response = await fetch(`${API}/sensores/status`);
      if (response.ok) {
        setServerStatus({
          online: true,
          text: "Sistema Operativo",
        });
      }
    } catch (error) {
      setServerStatus({ online: false, text: "Sistema Desconectado" });
    }
  };

  const loadHomeData = async () => {
    setLoading(true);
    try {
      const [resStatus, resAlerts] = await Promise.all([
        fetch(`${API}/sensores/status`),
        fetch(`${API}/sensores/alertas`),
      ]);

      const status = await resStatus.json();
      const alerts = await resAlerts.json();

      const cleaned = status.map((s) => ({
        ...s,
        data: Number(s.data),
      }));

      const totalSensores = cleaned.length;
      const totalAlertas = alerts.length;
      const operativos = totalSensores - totalAlertas;
      const promedioData =
        cleaned.reduce((acc, s) => acc + s.data, 0) / totalSensores || 0;

      setStats({
        totalSensores,
        totalAlertas,
        operativos,
        promedioData,
      });
    } catch (error) {
      console.error("Error cargando datos del home:", error);
    }
    setLoading(false);
  };

  return (
    <Container>
      <Header>
        <HeaderContent>
          <h1>Dashboard Datos Soterrados</h1>
          <Subtitle>Sistema de Monitoreo de Sensores en Tiempo Real</Subtitle>
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
            Sistema integral para el monitoreo y análisis de sensores soterrados.
            Visualice datos en tiempo real, revise históricos y genere
            estadísticas avanzadas.
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
                <StatValue>{stats.totalSensores}</StatValue>
                <StatLabel>Sensores Totales</StatLabel>
              </StatCard>

              <StatCard color="#4CAF50">
                <StatIcon>✓</StatIcon>
                <StatValue>{stats.operativos}</StatValue>
                <StatLabel>Operativos</StatLabel>
              </StatCard>

              <StatCard color="#FF5252">
                <StatIcon>⚠</StatIcon>
                <StatValue>{stats.totalAlertas}</StatValue>
                <StatLabel>Alertas Activas</StatLabel>
              </StatCard>

              <StatCard color="#FF9800">
                <StatIcon>📊</StatIcon>
                <StatValue>{stats.promedioData.toFixed(2)}</StatValue>
                <StatLabel>Promedio de Datos</StatLabel>
              </StatCard>
            </StatsGrid>
          </StatsSection>

          <FeaturesSection>
            <SectionTitle>Funcionalidades Principales</SectionTitle>
            <FeaturesGrid>
              <FeatureCard>
                <FeatureIcon>📈</FeatureIcon>
                <FeatureTitle>Estado General</FeatureTitle>
                <FeatureDescription>
                  Visualice el estado global de todos los sensores con gráficos
                  interactivos y métricas en tiempo real.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>🔍</FeatureIcon>
                <FeatureTitle>Sensores por Tipo</FeatureTitle>
                <FeatureDescription>
                  Analice la distribución de sensores por categorías y tipos con
                  gráficos de barras detallados.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📋</FeatureIcon>
                <FeatureTitle>Lista de Sensores</FeatureTitle>
                <FeatureDescription>
                  Acceda a la información completa de cada sensor: datos, hora,
                  dirección y detalles técnicos.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📊</FeatureIcon>
                <FeatureTitle>Historial</FeatureTitle>
                <FeatureDescription>
                  Revise el histórico completo de mediciones con gráficos de líneas
                  para análisis temporal.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>📉</FeatureIcon>
                <FeatureTitle>Estadísticas Avanzadas</FeatureTitle>
                <FeatureDescription>
                  Genere reportes con media móvil, curvas suavizadas, análisis de
                  variabilidad e histogramas.
                </FeatureDescription>
              </FeatureCard>

              <FeatureCard>
                <FeatureIcon>🎯</FeatureIcon>
                <FeatureTitle>Alertas Inteligentes</FeatureTitle>
                <FeatureDescription>
                  Reciba notificaciones sobre sensores con comportamiento anómalo o
                  fuera de rango.
                </FeatureDescription>
              </FeatureCard>
            </FeaturesGrid>
          </FeaturesSection>

          <QuickAccessSection>
            <SectionTitle>Acceso Rápido</SectionTitle>
            <QuickAccessGrid>
              <QuickAccessButton to="/estado">
                <ButtonIcon>🏠</ButtonIcon>
                <ButtonText>Ver Estado General</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton to="/lista">
                <ButtonIcon>📋</ButtonIcon>
                <ButtonText>Lista de Sensores</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton to="/historial">
                <ButtonIcon>📊</ButtonIcon>
                <ButtonText>Ver Historial</ButtonText>
              </QuickAccessButton>

              <QuickAccessButton to="/estadisticas">
                <ButtonIcon>📈</ButtonIcon>
                <ButtonText>Estadísticas Avanzadas</ButtonText>
              </QuickAccessButton>
            </QuickAccessGrid>
          </QuickAccessSection>
        </>
      )}

      <Footer>
        <FooterText>
          Dashboard Datos Soterrados © {new Date().getFullYear()} | Sistema de
          Monitoreo en Tiempo Real
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
