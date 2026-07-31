import React from 'react';
import { Shield, Zap, CheckCircle, Users, Download, ArrowRight, BookOpen, ChevronDown, ExternalLink, BookOpenCheck, UserCheck, Settings, Rocket, Lock, BarChart3, Target, Smartphone, Wrench } from 'lucide-react';

const Homepage = ({ onGetStarted, onViewDocumentation }) => {
  const scrollTo = (selector) => {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const keyFeatures = [
    {
      icon: <CheckCircle className="feature-icon" />,
      title: "Comprehensive Policies",
      description: "Complete baseline covering all the device configurations to enhance your managed endpoints."
    },
    {
      icon: <UserCheck className="feature-icon" />,
      title: "User Experience Focused",
      description: "Exceeds all other security frameworks by enhancing user experience and productivity."
    },
    {
      icon: <Shield className="feature-icon" />,
      title: "Industry Alignment",
      description: "Embraces frameworks like CIS, NCSC, and other security standards for maximum endpoint security."
    },
    {
      icon: <Zap className="feature-icon" />,
      title: "Easy Implementation",
      description: "Ready-to-deploy configuration templates that can be quickly imported into your Microsoft Intune environment."
    },
    {
      icon: <Settings className="feature-icon" />,
      title: "Customizable",
      description: "Designed to allow maximum flexibility and scaling to environments of any size."
    },
    {
      icon: <BookOpenCheck className="feature-icon" />,
      title: "Tried and Tested",
      description: "Extensively deployed in production environments, not just tested on VMs."
    }
  ];

  const benefits = [
    { icon: <Rocket className="benefit-icon" />, text: "Deploy 100+ security policies across multiple platforms in minutes" },
    { icon: <Lock className="benefit-icon" />, text: "Industry aligned configurations" },
    { icon: <BarChart3 className="benefit-icon" />, text: "Report status against existing OIB deployments" },
    { icon: <Target className="benefit-icon" />, text: "Granular policy selection by category and platform" },
    { icon: <Smartphone className="benefit-icon" />, text: "Device compliance, endpoint security, and configuration policies" },
    { icon: <Wrench className="benefit-icon" />, text: "Administrative templates and Windows Update policies" }
  ];

  return (
    <div className="homepage">

      {/* ── Section 1: Hero ─────────────────────────────────────── */}
      <section className="hero-section homepage-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Deploy and Manage
              <span className="hero-highlight"> OpenIntuneBaseline </span> in Microsoft Intune
            </h1>
            <p className="hero-description">
              The OpenIntuneBaseline project provides a comprehensive set of Microsoft Intune security 
              baselines designed to enhance your organization's security posture. Deploy proven security 
              configurations with enterprise-grade automation and governance.
            </p>
            <div className="hero-actions">
              <button 
                onClick={onGetStarted}
                className="btn btn-primary btn-large hero-cta"
              >
                <Download className="btn-icon" />
                Deploy Now
                <ArrowRight className="btn-icon-right" />
              </button>
              <button 
                onClick={onViewDocumentation}
                className="btn btn-outline btn-large"
              >
                <BookOpen className="btn-icon" />
                View Documentation
              </button>
            </div>
          </div>
        </div>

        <button className="scroll-indicator" onClick={() => scrollTo('.features-section')} aria-label="Scroll to features">
          <ChevronDown className="scroll-arrow" />
          <span>Explore Features</span>
        </button>
      </section>

      {/* ── Section 2: Why Choose ────────────────────────────────── */}
      <section className="features-section homepage-section">
        <div className="section-header">
          <h2>Why Choose OpenIntuneBaseline?</h2>
          <p>Built by experts, driven by community.</p>
          <p>Experience enterprise-grade security, without the complexity!</p>
        </div>
        
        <div className="features-grid">
          {keyFeatures.map((feature, index) => (
            <div key={index} className="feature-card">
              {feature.icon}
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>

        <button className="scroll-indicator scroll-indicator--dark" onClick={() => scrollTo('.benefits-section')} aria-label="Scroll to benefits">
          <ChevronDown className="scroll-arrow" />
          <span>Learn More</span>
        </button>
      </section>

      {/* ── Section 3: Benefits + About + CTA ───────────────────── */}
      <section className="benefits-section homepage-section">
        <div className="benefits-content">

          {/* Benefits list — centred across full width */}
          <div className="benefits-text">
            <h2>Strengthened Security Posture, Empowered User Experience</h2>
            <p className="benefits-intro">
              OpenIntuneBaseline provides a comprehensive, community-supported security baseline for
              Microsoft Intune, helping organizations implement robust endpoint security without
              compromising end user experience or manageability.
            </p>
            <ul className="benefits-list">
              {benefits.map((benefit, index) => (
                <li key={index} className="benefit-item">
                  {benefit.icon}
                  <span>{benefit.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* About — three pillars, full width */}
          <div className="about-section">
            <h3 className="about-heading">About OpenIntuneBaseline</h3>
            <p className="about-intro">
              OpenIntuneBaseline is an open-source project that provides a comprehensive,
              community-maintained security baseline for Microsoft Intune. Our mission is to
              democratize enterprise-grade endpoint security by making proven configurations
              accessible to organizations of all sizes.
            </p>
            <div className="about-pillars">
              <div className="about-pillar">
                <Users className="pillar-icon" />
                <h4>Community-First Approach</h4>
                <p>Built and maintained by security professionals who understand real-world challenges and requirements.</p>
              </div>
              <div className="about-pillar">
                <Shield className="pillar-icon" />
                <h4>Proven in Production</h4>
                <p>Configurations are tested and validated in real enterprise environments before being shared with the community.</p>
              </div>
              <div className="about-pillar">
                <Zap className="pillar-icon" />
                <h4>Continuously Updated</h4>
                <p>Regular updates ensure compatibility with the latest Microsoft Intune features and emerging security threats.</p>
              </div>
            </div>
          </div>

          {/* Split CTA */}
          <div className="benefits-cta-row">
            <button
              onClick={onGetStarted}
              className="btn btn-primary btn-large cta-button"
            >
              <Shield className="btn-icon" />
              Deploy OpenIntuneBaseline
              <ArrowRight className="btn-icon-right" />
            </button>
            <a
              href="https://github.com/SkipToTheEndpoint/OpenIntuneBaseline"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-large cta-button-secondary"
            >
              <ExternalLink className="btn-icon" />
              Learn More on GitHub
            </a>
          </div>
          <p className="cta-note-standalone">
            Requires DeviceManagementConfiguration.ReadWrite.All permissions
          </p>

        </div>
      </section>

    </div>
  );
};

export default Homepage;
