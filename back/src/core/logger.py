import logging
import sys


class SimpleLogger:
    """Logger simple avec sortie temps réel et préfixes explicites."""

    def __init__(self, name: str = "SynkAPI", level: int = logging.INFO):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.logger.propagate = False

        if not self.logger.handlers:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(level)
            formatter = logging.Formatter(
                "%(asctime)s - %(levelname)s - %(message)s",
                datefmt="%H:%M:%S",
            )
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)

    def info(self, message: str) -> None:
        self.logger.info(f"ℹ️  {message}")
        sys.stdout.flush()

    def success(self, message: str) -> None:
        self.logger.info(f"✅ {message}")
        sys.stdout.flush()

    def warning(self, message: str) -> None:
        self.logger.warning(f"⚠️  {message}")
        sys.stdout.flush()

    def error(self, message: str) -> None:
        self.logger.error(f"❌ {message}")
        sys.stdout.flush()

    def debug(self, message: str) -> None:
        self.logger.debug(f"🔧 {message}")
        sys.stdout.flush()


# Instance unique pour l'application
logger = SimpleLogger()
